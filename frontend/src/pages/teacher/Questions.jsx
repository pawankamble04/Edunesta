import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../../services/api";

export default function Questions() {
  const [params] = useSearchParams();
  const testId = params.get("testId");

  const [question, setQuestion] = useState({
    text: "",
    options: ["", "", "", ""],
    correctAnswers: [],
    marks: 1,
    topic: "",
  });

  const [aiReview, setAiReview] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  /* ---------------- OPTIONS ---------------- */
  const setOption = (i, value) => {
    const options = [...question.options];
    options[i] = value;
    setQuestion({ ...question, options });
  };

  const toggleCorrect = (i) => {
    setQuestion((prev) => ({
      ...prev,
      correctAnswers: prev.correctAnswers.includes(i)
        ? prev.correctAnswers.filter((x) => x !== i)
        : [...prev.correctAnswers, i],
    }));
  };

  /* ---------------- AI REVIEW ---------------- */
  const checkWithAI = async () => {
    try {
      setLoadingAI(true);
      setAiReview(null);

      const res = await API.post("/ai/question-review", {
        question: question.text,
        options: question.options,
        correctAnswer: question.correctAnswers.map(
          (i) => question.options[i]
        ),
        topic: question.topic || "General",
      });

      // Ensure parsed JSON
      let parsed =
        typeof res.data.review === "string"
          ? JSON.parse(res.data.review)
          : res.data.review;

      setAiReview(parsed);
    } catch (err) {
      alert("AI review failed or returned invalid format");
    } finally {
      setLoadingAI(false);
    }
  };

  /* ---------------- SAVE QUESTION ---------------- */
  const saveQuestion = async () => {
    if (aiReview && aiReview.clarityScore < 5) {
      alert(
        "Question clarity is too low. Please improve the question before saving."
      );
      return;
    }

    try {
      await API.post("/questions", {
        testId,
        ...question,
      });

      alert("Question saved successfully");

      setQuestion({
        text: "",
        options: ["", "", "", ""],
        correctAnswers: [],
        marks: 1,
        topic: "",
      });

      setAiReview(null);
    } catch {
      alert("Error saving question");
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Add Question</h1>

      <div className="bg-white border rounded p-6 space-y-4">
        <textarea
          placeholder="Question text"
          className="w-full border p-2 rounded"
          rows="3"
          value={question.text}
          onChange={(e) =>
            setQuestion({ ...question, text: e.target.value })
          }
        />

        <input
          placeholder="Topic (Arrays, DBMS, OS...)"
          className="w-full border p-2 rounded"
          value={question.topic}
          onChange={(e) =>
            setQuestion({ ...question, topic: e.target.value })
          }
        />

        {question.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="flex-1 border p-2 rounded"
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
            />
            <input
              type="checkbox"
              checked={question.correctAnswers.includes(i)}
              onChange={() => toggleCorrect(i)}
            />
          </div>
        ))}

        <input
          type="number"
          placeholder="Marks"
          className="border p-2 rounded"
          value={question.marks}
          onChange={(e) =>
            setQuestion({
              ...question,
              marks: Number(e.target.value),
            })
          }
        />

        {/* AI CHECK BUTTON */}
        <button
          onClick={checkWithAI}
          disabled={loadingAI}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loadingAI ? "Analyzing with AI..." : "Check Question with AI"}
        </button>

        {/* AI REVIEW OUTPUT */}
        {aiReview && (
          <div
            className={`border rounded p-4 text-sm ${
              aiReview.clarityScore < 5
                ? "bg-red-50 border-red-300"
                : "bg-green-50 border-green-300"
            }`}
          >
            <h3 className="font-semibold mb-2">
              AI Quality Review
            </h3>

            <p>
              <strong>Difficulty:</strong>{" "}
              {aiReview.difficulty}
            </p>

            <p>
              <strong>Clarity Score:</strong>{" "}
              {aiReview.clarityScore}/10
            </p>

            {aiReview.clarityScore < 5 && (
              <p className="text-red-600 font-semibold mt-2">
                ⚠ Question clarity is low. Improvement recommended.
              </p>
            )}

            {aiReview.issues?.length > 0 && (
              <div className="mt-2">
                <strong>Issues:</strong>
                <ul className="list-disc ml-5">
                  {aiReview.issues.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiReview.improvementSuggestions?.length > 0 && (
              <div className="mt-2">
                <strong>Suggestions:</strong>
                <ul className="list-disc ml-5">
                  {aiReview.improvementSuggestions.map(
                    (s, idx) => (
                      <li key={idx}>{s}</li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* SAVE */}
        <button
          onClick={saveQuestion}
          disabled={aiReview && aiReview.clarityScore < 5}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Save Question
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
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

  // ✅ STEP 2: store question list
  const [questions, setQuestions] = useState([]);

  // ✅ STEP 3B: edit mode
  const [editingId, setEditingId] = useState(null);

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

  // ✅ STEP 2: load questions for this test
  useEffect(() => {
    if (!testId) return;

    API.get(`/questions/${testId}`)
      .then((res) => setQuestions(res.data))
      .catch(() => alert("Failed to load questions"));
  }, [testId]);

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
    if (question.correctAnswers.length !== 1) {
      alert("Select exactly one correct answer");
      return;
    }

    if (aiReview && aiReview.clarityScore < 5) {
      alert(
        "Question clarity is too low. Please improve the question before saving."
      );
      return;
    }

    try {
      await (editingId
        ? API.put(`/questions/${editingId}`, {
            text: question.text,
            options: question.options,
            correctAnswer: question.correctAnswers[0],
            marks: question.marks,
            topic: question.topic,
          })
        : API.post(`/questions/${testId}`, {
            text: question.text,
            options: question.options,
            correctAnswer: question.correctAnswers[0],
            marks: question.marks,
            topic: question.topic,
          })
      );

      alert("Question saved successfully");

      setEditingId(null); // ✅ reset edit mode

      setQuestion({
        text: "",
        options: ["", "", "", ""],
        correctAnswers: [],
        marks: 1,
        topic: "",
      });

      setAiReview(null);

      // 🔄 refresh question list
      const res = await API.get(`/questions/${testId}`);
      setQuestions(res.data);
    } catch {
      alert("Error saving question");
    }
  };

  // ✅ STEP 2: delete question
  const deleteQuestion = async (id) => {
    if (!window.confirm("Delete this question?")) return;

    try {
      await API.delete(`/questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q._id !== id));
    } catch {
      alert("Failed to delete question");
    }
  };

  // ✅ STEP 3B: load question into form
  const editQuestion = (q) => {
    setEditingId(q._id);
    setQuestion({
      text: q.text,
      options: q.options,
      correctAnswers: [q.correctAnswer],
      marks: q.marks,
      topic: q.topic || "",
    });
    setAiReview(null);
  };

  return (
    <div className="max-w-2xl">

      {/* ✅ STEP 2: QUESTION LIST */}
      {questions.length > 0 && (
        <div className="mb-8 bg-white border rounded p-4">
          <h2 className="font-semibold mb-3">
            Questions in this Test
          </h2>

          <ul className="space-y-2 text-sm">
            {questions.map((q, idx) => (
              <li
                key={q._id}
                className="border p-3 rounded flex justify-between"
              >
                <div>
                  <p className="font-medium">
                    {idx + 1}. {q.text}
                  </p>
                  <p className="text-gray-600">
                    Options: {q.options.length} | Correct: Option{" "}
                    {q.correctAnswer + 1}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => editQuestion(q)}
                    className="text-blue-600 text-sm"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteQuestion(q._id)}
                    className="text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h1 className="text-xl font-bold mb-6">
        {editingId ? "Edit Question" : "Add Question"}
      </h1>

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

        <button
          onClick={checkWithAI}
          disabled={loadingAI}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loadingAI ? "Analyzing with AI..." : "Check Question with AI"}
        </button>

        {aiReview && (
          <div className="border rounded p-4 text-sm bg-green-50 border-green-300">
            <strong>Clarity Score:</strong> {aiReview.clarityScore}/10
          </div>
        )}

        <button
          onClick={saveQuestion}
          disabled={aiReview && aiReview.clarityScore < 5}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update Question" : "Save Question"}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../../services/api";

export default function Questions() {
  const [params] = useSearchParams();
  const testId = params.get("testId");

  const [question, setQuestion] = useState({
    text: "",
    options: ["", "", "", ""],
    correctAnswer: null,
    marks: 1,
    topic: "",
  });

  const [questions, setQuestions] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [aiReview, setAiReview] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [status, setStatus] = useState({
    type: "",
    text: "",
  });

  /* ================= LOAD QUESTIONS ================= */
  useEffect(() => {
    if (!testId) return;

    API.get(`/questions/test/${testId}`)
      .then((res) => setQuestions(res.data))
      .catch(() =>
        setStatus({ type: "error", text: "Failed to load questions" })
      );
  }, [testId]);

  /* ================= OPTIONS ================= */
  const setOption = (i, value) => {
    const options = [...question.options];
    options[i] = value;
    setQuestion({ ...question, options });
    setAiReview(null);
  };

  const setCorrect = (i) => {
    setQuestion((prev) => ({
      ...prev,
      correctAnswer: i,
    }));
    setAiReview(null);
  };

  /* ================= AI CHECK ================= */
  const checkWithAI = async () => {
    setStatus({ type: "", text: "" });
    if (question.correctAnswer === null) {
      setStatus({
        type: "error",
        text: "Select correct answer before AI check",
      });
      return;
    }

    try {
      setLoadingAI(true);
      setAiReview(null);

      const res = await API.post("/ai/question-review", {
        question: question.text,
        options: question.options,
        correctAnswer: question.options[question.correctAnswer],
        topic: question.topic || "General",
      });

      const parsed =
        typeof res.data.review === "string"
          ? JSON.parse(res.data.review)
          : res.data.review;

      setAiReview(parsed);
    } catch {
      setStatus({ type: "error", text: "AI review failed" });
    } finally {
      setLoadingAI(false);
    }
  };

  /* ================= SAVE QUESTION ================= */
  const saveQuestion = async () => {
    setStatus({ type: "", text: "" });
    if (!aiReview || typeof aiReview.clarityScore !== "number") {
      setStatus({
        type: "error",
        text: "Run AI review before saving this question",
      });
      return;
    }

    if (question.correctAnswer === null) {
      setStatus({
        type: "error",
        text: "Select exactly one correct answer",
      });
      return;
    }

    if (aiReview && aiReview.clarityScore < 5) {
      setStatus({
        type: "error",
        text: "Question clarity is too low",
      });
      return;
    }

    try {
      if (editingId) {
        await API.put(`/questions/${editingId}`, {
          text: question.text,
          options: question.options,
          correctAnswer: question.correctAnswer,
          marks: question.marks,
          topic: question.topic,
          aiReview,
        });
      } else {
        await API.post(`/questions/test/${testId}`, {
          text: question.text,
          options: question.options,
          correctAnswer: question.correctAnswer,
          marks: question.marks,
          topic: question.topic,
          aiReview,
        });
      }

      setStatus({
        type: "success",
        text: "Question saved successfully.",
      });

      setEditingId(null);
      setQuestion({
        text: "",
        options: ["", "", "", ""],
        correctAnswer: null,
        marks: 1,
        topic: "",
      });
      setAiReview(null);

      const res = await API.get(`/questions/test/${testId}`);
      setQuestions(res.data);
    } catch {
      setStatus({ type: "error", text: "Error saving question" });
    }
  };

  /* ================= DELETE ================= */
  const deleteQuestion = async (id) => {
    setStatus({ type: "", text: "" });
    if (!window.confirm("Delete this question?")) return;

    try {
      await API.delete(`/questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q._id !== id));
    } catch {
      setStatus({ type: "error", text: "Failed to delete question" });
    }
  };

  /* ================= EDIT ================= */
  const editQuestion = (q) => {
    setEditingId(q._id);
    setQuestion({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      marks: q.marks,
      topic: q.topic || "",
    });
    setAiReview(q.aiReview || null);
  };

  return (
    <div className="max-w-2xl">
      {/* ================= QUESTION LIST ================= */}
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
      {status.text && (
        <p
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            status.type === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {status.text}
        </p>
      )}

      <div className="bg-white border rounded p-6 space-y-4">
        <textarea
          placeholder="Question text"
          className="w-full border p-2 rounded"
          rows="3"
          value={question.text}
          onChange={(e) => {
            setQuestion({ ...question, text: e.target.value });
            setAiReview(null);
          }}
        />

        <input
          placeholder="Topic (Arrays, DBMS, OS...)"
          className="w-full border p-2 rounded"
          value={question.topic}
          onChange={(e) => {
            setQuestion({ ...question, topic: e.target.value });
            setAiReview(null);
          }}
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
              type="radio"
              name="correct"
              checked={question.correctAnswer === i}
              onChange={() => setCorrect(i)}
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
          disabled={!aiReview || aiReview.clarityScore < 5}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update Question" : "Save Question"}
        </button>
      </div>
    </div>
  );
}

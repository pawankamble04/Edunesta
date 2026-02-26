import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../../services/api";

const AUTO_MCQ_DEFAULT_COUNT = 10;
const AUTO_MCQ_MIN_COUNT = 1;
const AUTO_MCQ_MAX_COUNT = 20;
const AUTO_MCQ_MIN_PARAGRAPH_LENGTH = 80;
const DEFAULT_MIN_CLARITY_SCORE = 5;

const emptyQuestion = () => ({
  text: "",
  options: ["", "", "", ""],
  correctAnswer: null,
  marks: 1,
  topic: "",
  isPyq: false,
  pyqExamType: "",
  pyqYear: "",
  pyqSource: "",
});

const optionLabel = (index) => String.fromCharCode(65 + index);

const normalizeGeneratedReview = (review) => {
  const source = review && typeof review === "object" ? review : {};
  const clarityRaw = Number(source.clarityScore);
  const clarityScore = Number.isFinite(clarityRaw)
    ? Math.min(Math.max(Math.round(clarityRaw), 1), 10)
    : 7;
  const difficultyRaw = String(source.difficulty || "").trim().toLowerCase();
  let difficulty = "Medium";
  if (difficultyRaw === "easy") difficulty = "Easy";
  if (difficultyRaw === "hard") difficulty = "Hard";

  return {
    clarityScore: Math.max(clarityScore, DEFAULT_MIN_CLARITY_SCORE),
    difficulty,
    issues: Array.isArray(source.issues)
      ? source.issues.map((item) => String(item || "")).filter(Boolean)
      : [],
    improvementSuggestions: Array.isArray(source.improvementSuggestions)
      ? source.improvementSuggestions
          .map((item) => String(item || ""))
          .filter(Boolean)
      : [],
    reviewedAt: source.reviewedAt || new Date().toISOString(),
  };
};

const normalizeGeneratedQuestion = (row, index) => {
  const text = String(row?.text || row?.question || "").trim();
  const options = Array.isArray(row?.options)
    ? row.options.map((opt) => String(opt || "").trim()).filter(Boolean)
    : [];
  const correctAnswer = Number(row?.correctAnswer);
  const marks = Number(row?.marks);

  if (text.length < 5 || options.length < 2 || !Number.isInteger(correctAnswer)) {
    return null;
  }
  if (correctAnswer < 0 || correctAnswer >= options.length) return null;

  return {
    clientId: `gen-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    options,
    correctAnswer,
    marks: Number.isFinite(marks) && marks > 0 ? Math.floor(marks) : 1,
    topic: String(row?.topic || "Comprehension").trim() || "Comprehension",
    aiReview: normalizeGeneratedReview(row?.aiReview),
  };
};

export default function Questions() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const testId = params.get("testId");

  const [question, setQuestion] = useState(emptyQuestion());
  const [questions, setQuestions] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [testMeta, setTestMeta] = useState(null);
  const [loadingPage, setLoadingPage] = useState(false);

  const [aiReview, setAiReview] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const [paragraphInput, setParagraphInput] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [autoTopic, setAutoTopic] = useState("");
  const [autoCount, setAutoCount] = useState(AUTO_MCQ_DEFAULT_COUNT);
  const [autoMarks, setAutoMarks] = useState(1);
  const [autoMeta, setAutoMeta] = useState({
    source: "",
    warning: "",
  });
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [loadingAutoGenerate, setLoadingAutoGenerate] = useState(false);
  const [savingGenerated, setSavingGenerated] = useState(false);

  const [status, setStatus] = useState({
    type: "",
    text: "",
  });

  const loadPageData = async () => {
    if (!testId) return;
    setLoadingPage(true);

    try {
      const [questionRes, testRes] = await Promise.all([
        API.get(`/questions/test/${testId}`),
        API.get(`/tests/${testId}`),
      ]);

      setQuestions(Array.isArray(questionRes.data) ? questionRes.data : []);
      setTestMeta(testRes.data || null);
    } catch {
      setStatus({
        type: "error",
        text: "Failed to load test or questions.",
      });
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (!testId) return;
    void loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

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
        correctAnswer: question.correctAnswer,
        topic: question.topic || "General",
      });

      const parsed =
        typeof res.data.review === "string"
          ? JSON.parse(res.data.review)
          : res.data.review;

      setAiReview(parsed);
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "AI review failed",
      });
    } finally {
      setLoadingAI(false);
    }
  };

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

    if (aiReview.clarityScore < DEFAULT_MIN_CLARITY_SCORE) {
      setStatus({
        type: "error",
        text: "Question clarity is too low",
      });
      return;
    }

    try {
      const pyqPayload = {
        isPyq: Boolean(question.isPyq),
        pyqExamType: question.isPyq ? String(question.pyqExamType || "") : "",
        pyqYear:
          question.isPyq && Number.isInteger(Number(question.pyqYear))
            ? Number(question.pyqYear)
            : null,
        pyqSource: question.isPyq ? String(question.pyqSource || "") : "",
      };

      if (editingId) {
        await API.put(`/questions/${editingId}`, {
          text: question.text,
          options: question.options,
          correctAnswer: question.correctAnswer,
          marks: question.marks,
          topic: question.topic,
          ...pyqPayload,
          aiReview,
        });
      } else {
        await API.post(`/questions/test/${testId}`, {
          text: question.text,
          options: question.options,
          correctAnswer: question.correctAnswer,
          marks: question.marks,
          topic: question.topic,
          ...pyqPayload,
          aiReview,
        });
      }

      setStatus({
        type: "success",
        text: "Question saved successfully.",
      });
      setEditingId(null);
      setQuestion(emptyQuestion());
      setAiReview(null);
      await loadPageData();
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Error saving question",
      });
    }
  };

  const deleteQuestion = async (id) => {
    setStatus({ type: "", text: "" });
    if (!window.confirm("Delete this question?")) return;

    try {
      await API.delete(`/questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q._id !== id));
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to delete question",
      });
    }
  };

  const editQuestion = (q) => {
    setEditingId(q._id);
    setQuestion({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      marks: q.marks,
      topic: q.topic || "",
      isPyq: Boolean(q.isPyq),
      pyqExamType: q.pyqExamType || "",
      pyqYear: Number.isInteger(Number(q.pyqYear)) ? String(q.pyqYear) : "",
      pyqSource: q.pyqSource || "",
    });
    setAiReview(q.aiReview || null);
  };

  const generateFromParagraph = async () => {
    setStatus({ type: "", text: "" });
    const paragraph = String(paragraphInput || "").trim();

    if (paragraph.length < AUTO_MCQ_MIN_PARAGRAPH_LENGTH) {
      setStatus({
        type: "error",
        text: `Paragraph must be at least ${AUTO_MCQ_MIN_PARAGRAPH_LENGTH} characters.`,
      });
      return;
    }

    try {
      setLoadingAutoGenerate(true);
      setAutoMeta({ source: "", warning: "" });

      const count = Math.min(
        Math.max(Number(autoCount) || AUTO_MCQ_DEFAULT_COUNT, AUTO_MCQ_MIN_COUNT),
        AUTO_MCQ_MAX_COUNT
      );
      const marks = Math.max(Number(autoMarks) || 1, 1);

      const res = await API.post("/ai/mcq-from-paragraph", {
        paragraph,
        count,
        topic: autoTopic || question.topic || testMeta?.subject || "Comprehension",
        marks,
      });

      const rows = Array.isArray(res.data?.questions) ? res.data.questions : [];
      const normalized = rows
        .map((row, index) => normalizeGeneratedQuestion(row, index))
        .filter(Boolean);

      if (!normalized.length) {
        setStatus({
          type: "error",
          text: "AI could not generate valid MCQs from this paragraph.",
        });
        return;
      }

      setGeneratedQuestions(normalized);
      setAutoMeta({
        source: String(res.data?.source || "ai"),
        warning: String(res.data?.warning || ""),
      });
      setStatus({
        type: "success",
        text: `Generated ${normalized.length} MCQs. Review and save to this test.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to generate MCQs from paragraph.",
      });
    } finally {
      setLoadingAutoGenerate(false);
    }
  };

  const generateFromPdf = async () => {
    setStatus({ type: "", text: "" });

    if (!pdfFile) {
      setStatus({ type: "error", text: "Upload a PDF first." });
      return;
    }

    try {
      setLoadingAutoGenerate(true);
      setAutoMeta({ source: "", warning: "" });

      const count = Math.min(
        Math.max(Number(autoCount) || AUTO_MCQ_DEFAULT_COUNT, AUTO_MCQ_MIN_COUNT),
        AUTO_MCQ_MAX_COUNT
      );
      const marks = Math.max(Number(autoMarks) || 1, 1);

      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("count", String(count));
      formData.append("marks", String(marks));
      formData.append(
        "topic",
        autoTopic || question.topic || testMeta?.subject || "Comprehension"
      );

      const res = await API.post("/ai/mcq-from-pdf", formData);
      const rows = Array.isArray(res.data?.questions) ? res.data.questions : [];
      const normalized = rows
        .map((row, index) => normalizeGeneratedQuestion(row, index))
        .filter(Boolean);

      if (!normalized.length) {
        setStatus({
          type: "error",
          text: "AI could not generate valid MCQs from this PDF.",
        });
        return;
      }

      setGeneratedQuestions(normalized);
      setAutoMeta({
        source: String(res.data?.source || "ai"),
        warning: String(res.data?.warning || ""),
      });
      setStatus({
        type: "success",
        text: `Generated ${normalized.length} MCQs from PDF. Review and save to this test.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to generate MCQs from PDF.",
      });
    } finally {
      setLoadingAutoGenerate(false);
    }
  };

  const deleteGeneratedQuestion = (clientId) => {
    setGeneratedQuestions((prev) => prev.filter((q) => q.clientId !== clientId));
  };

  const saveGeneratedQuestions = async () => {
    if (!generatedQuestions.length) return;
    setStatus({ type: "", text: "" });
    setSavingGenerated(true);

    let savedCount = 0;
    const failed = [];

    try {
      for (const generated of generatedQuestions) {
        try {
          await API.post(`/questions/test/${testId}`, {
            text: generated.text,
            options: generated.options,
            correctAnswer: generated.correctAnswer,
            marks: generated.marks,
            topic: generated.topic,
            aiReview: generated.aiReview,
          });
          savedCount += 1;
        } catch (err) {
          failed.push({
            question: generated,
            error: err.response?.data?.message || "Save failed",
          });
        }
      }

      setGeneratedQuestions(failed.map((row) => row.question));
      await loadPageData();

      if (failed.length > 0) {
        setStatus({
          type: "error",
          text: `${savedCount} saved, ${failed.length} failed. ${failed[0].error}`,
        });
      } else {
        setStatus({
          type: "success",
          text: `Saved ${savedCount} generated questions.`,
        });
      }
    } finally {
      setSavingGenerated(false);
    }
  };

  const togglePublishTest = async () => {
    if (!testId) return;
    setStatus({ type: "", text: "" });

    try {
      const res = await API.put(`/tests/${testId}/publish`);
      setTestMeta((prev) =>
        prev ? { ...prev, isPublished: res.data.isPublished } : prev
      );
      setStatus({
        type: "success",
        text: res.data?.message || "Publish status updated.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to update publish status.",
      });
    }
  };

  if (!testId) {
    return (
      <div className="max-w-xl rounded border bg-white p-6">
        <h1 className="text-xl font-bold mb-2">Questions</h1>
        <p className="text-sm text-gray-700 mb-4">
          Open this page from a specific test first.
        </p>
        <button
          type="button"
          onClick={() => navigate("/teacher/tests")}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Back to My Tests
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {testMeta?.title ? `Questions - ${testMeta.title}` : "Questions"}
          </h1>
          <p className="text-sm text-gray-600">
            Subject: {testMeta?.subject || "-"} | Status:{" "}
            <span className={testMeta?.isPublished ? "text-green-700" : "text-yellow-700"}>
              {testMeta?.isPublished ? "Published" : "Draft"}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate("/teacher/tests")}
            className="rounded border px-3 py-2 text-sm"
          >
            Back to Tests
          </button>
          <button
            type="button"
            onClick={togglePublishTest}
            className={`rounded px-3 py-2 text-sm text-white ${
              testMeta?.isPublished ? "bg-red-600" : "bg-green-600"
            }`}
          >
            {testMeta?.isPublished ? "Unpublish Test" : "Publish Test"}
          </button>
        </div>
      </div>

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

      <div className="mb-8 rounded border bg-white p-5">
        <h2 className="font-semibold mb-2">
          AI MCQ Auto Test (Paragraph/PDF to MCQs)
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Paste a paragraph or upload a PDF, generate MCQs, review answers,
          delete any wrong ones, then save all questions to this test.
        </p>

        <textarea
          rows={7}
          placeholder="Paste your paragraph here..."
          className="w-full rounded border p-2"
          value={paragraphInput}
          onChange={(e) => setParagraphInput(e.target.value)}
        />

        <div className="mt-3 rounded border border-dashed bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Or upload syllabus PDF
          </p>
          <input
            type="file"
            accept="application/pdf"
            className="block w-full text-sm"
            onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          />
          {pdfFile ? (
            <p className="mt-1 text-xs text-gray-600">Selected: {pdfFile.name}</p>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            type="text"
            placeholder="Topic (optional)"
            className="rounded border p-2"
            value={autoTopic}
            onChange={(e) => setAutoTopic(e.target.value)}
          />
          <input
            type="number"
            min={AUTO_MCQ_MIN_COUNT}
            max={AUTO_MCQ_MAX_COUNT}
            className="rounded border p-2"
            value={autoCount}
            onChange={(e) => setAutoCount(Number(e.target.value))}
          />
          <input
            type="number"
            min={1}
            max={100}
            className="rounded border p-2"
            value={autoMarks}
            onChange={(e) => setAutoMarks(Number(e.target.value))}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateFromParagraph}
            disabled={loadingAutoGenerate}
            className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {loadingAutoGenerate ? "Generating..." : "Generate from Paragraph"}
          </button>

          <button
            type="button"
            onClick={generateFromPdf}
            disabled={loadingAutoGenerate}
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
          >
            {loadingAutoGenerate ? "Generating..." : "Generate from PDF"}
          </button>

          <button
            type="button"
            onClick={saveGeneratedQuestions}
            disabled={!generatedQuestions.length || savingGenerated}
            className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {savingGenerated ? "Saving..." : "Save Generated Questions"}
          </button>
        </div>

        {autoMeta.warning ? (
          <p className="mt-2 text-xs text-amber-700">
            {autoMeta.warning}
            {autoMeta.source ? ` (source: ${autoMeta.source})` : ""}
          </p>
        ) : null}

        {generatedQuestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {generatedQuestions.map((generated, index) => (
              <div
                key={generated.clientId}
                className="rounded border bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {index + 1}. {generated.text}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      Topic: {generated.topic} | Marks: {generated.marks} |
                      Correct: Option {optionLabel(generated.correctAnswer)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteGeneratedQuestion(generated.clientId)}
                    className="text-sm text-red-600"
                  >
                    Delete
                  </button>
                </div>

                <ul className="mt-2 space-y-1 text-sm">
                  {generated.options.map((opt, optionIndex) => (
                    <li
                      key={`${generated.clientId}-${optionIndex}`}
                      className={`rounded border px-2 py-1 ${
                        generated.correctAnswer === optionIndex
                          ? "border-green-300 bg-green-100"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className="mr-2 font-semibold">
                        {optionLabel(optionIndex)}.
                      </span>
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {loadingPage ? (
        <p className="mb-6 text-sm text-gray-600">Loading questions...</p>
      ) : null}

      {questions.length > 0 && (
        <div className="mb-8 bg-white border rounded p-4">
          <h2 className="font-semibold mb-3">Questions in this Test</h2>

          <ul className="space-y-2 text-sm">
            {questions.map((q, idx) => (
              <li key={q._id} className="border p-3 rounded flex justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {idx + 1}. {q.text}
                  </p>
                  <p className="text-gray-600">
                    Options: {q.options.length} | Correct: Option{" "}
                    {q.correctAnswer + 1}
                  </p>
                  {q.isPyq && (
                    <p className="text-xs text-orange-700">
                      PYQ {q.pyqExamType ? `(${q.pyqExamType})` : ""}{" "}
                      {q.pyqYear ? `| Year: ${q.pyqYear}` : ""}{" "}
                      {q.pyqSource ? `| Source: ${q.pyqSource}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => editQuestion(q)} className="text-blue-600 text-sm">
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

      <h2 className="text-xl font-bold mb-4">
        {editingId ? "Edit Question" : "Add Question Manually"}
      </h2>

      <div className="bg-white border rounded p-6 space-y-4">
        <textarea
          placeholder="Question text"
          className="w-full border p-2 rounded"
          rows={3}
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

        <div className="rounded border p-3 bg-orange-50 border-orange-200">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={Boolean(question.isPyq)}
              onChange={(e) =>
                setQuestion((prev) => ({
                  ...prev,
                  isPyq: e.target.checked,
                  pyqExamType: e.target.checked ? prev.pyqExamType : "",
                  pyqYear: e.target.checked ? prev.pyqYear : "",
                  pyqSource: e.target.checked ? prev.pyqSource : "",
                }))
              }
            />
            Mark this as PYQ Question
          </label>

          {question.isPyq && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                className="border p-2 rounded"
                value={question.pyqExamType}
                onChange={(e) =>
                  setQuestion((prev) => ({
                    ...prev,
                    pyqExamType: e.target.value,
                  }))
                }
              >
                <option value="">Select Exam</option>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
              </select>

              <input
                type="number"
                min={1990}
                max={2100}
                placeholder="PYQ Year (e.g. 2021)"
                className="border p-2 rounded"
                value={question.pyqYear}
                onChange={(e) =>
                  setQuestion((prev) => ({
                    ...prev,
                    pyqYear: e.target.value,
                  }))
                }
              />

              <input
                type="text"
                placeholder="Source (e.g. JEE Main Shift 1)"
                className="border p-2 rounded"
                value={question.pyqSource}
                onChange={(e) =>
                  setQuestion((prev) => ({
                    ...prev,
                    pyqSource: e.target.value,
                  }))
                }
              />
            </div>
          )}
        </div>

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
          type="button"
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
          type="button"
          onClick={saveQuestion}
          disabled={!aiReview || aiReview.clarityScore < DEFAULT_MIN_CLARITY_SCORE}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update Question" : "Save Question"}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../../services/api";

const AUTO_MCQ_DEFAULT_COUNT = 10;
const AUTO_MCQ_MIN_COUNT = 1;
const AUTO_MCQ_MAX_COUNT = 20;
const AUTO_MCQ_MIN_PARAGRAPH_LENGTH = 80;
const DEFAULT_MIN_CLARITY_SCORE = 5;

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

export default function AITestCreator() {
  const [params] = useSearchParams();
  const initialTestId = String(params.get("testId") || "").trim();

  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState(initialTestId);

  const [paragraphInput, setParagraphInput] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [autoTopic, setAutoTopic] = useState("");
  const [autoCount, setAutoCount] = useState(AUTO_MCQ_DEFAULT_COUNT);
  const [autoMarks, setAutoMarks] = useState(1);
  const [autoMeta, setAutoMeta] = useState({ source: "", warning: "" });

  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [savingGenerated, setSavingGenerated] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [status, setStatus] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const loadTests = async () => {
      try {
        const res = await API.get("/tests");
        const list = Array.isArray(res.data) ? res.data : [];
        setTests(list);
        setSelectedTestId((prev) => {
          if (prev && list.some((test) => test._id === prev)) return prev;
          return list[0]?._id || "";
        });
      } catch {
        setStatus({ type: "error", text: "Failed to load your tests." });
      } finally {
        setLoadingTests(false);
      }
    };

    void loadTests();
  }, []);

  const selectedTest = useMemo(
    () => tests.find((test) => test._id === selectedTestId) || null,
    [tests, selectedTestId]
  );

  const generateFromParagraph = async () => {
    setStatus({ type: "", text: "" });

    if (!selectedTestId) {
      setStatus({ type: "error", text: "Select a test first." });
      return;
    }

    const paragraph = String(paragraphInput || "").trim();
    if (paragraph.length < AUTO_MCQ_MIN_PARAGRAPH_LENGTH) {
      setStatus({
        type: "error",
        text: `Paragraph must be at least ${AUTO_MCQ_MIN_PARAGRAPH_LENGTH} characters.`,
      });
      return;
    }

    try {
      setLoadingGenerate(true);
      setAutoMeta({ source: "", warning: "" });

      const count = Math.min(
        Math.max(Number(autoCount) || AUTO_MCQ_DEFAULT_COUNT, AUTO_MCQ_MIN_COUNT),
        AUTO_MCQ_MAX_COUNT
      );
      const marks = Math.max(Number(autoMarks) || 1, 1);

      const res = await API.post("/ai/mcq-from-paragraph", {
        paragraph,
        count,
        topic: autoTopic || selectedTest?.subject || "Comprehension",
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
        text: `Generated ${normalized.length} MCQs. Review and click Save.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to generate MCQs from paragraph.",
      });
    } finally {
      setLoadingGenerate(false);
    }
  };

  const generateFromPdf = async () => {
    setStatus({ type: "", text: "" });

    if (!selectedTestId) {
      setStatus({ type: "error", text: "Select a test first." });
      return;
    }
    if (!pdfFile) {
      setStatus({ type: "error", text: "Upload a PDF first." });
      return;
    }

    try {
      setLoadingGenerate(true);
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
        autoTopic || selectedTest?.subject || "Comprehension"
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
        text: `Generated ${normalized.length} MCQs from PDF. Review and click Save.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to generate MCQs from PDF.",
      });
    } finally {
      setLoadingGenerate(false);
    }
  };

  const deleteGeneratedQuestion = (clientId) => {
    setGeneratedQuestions((prev) => prev.filter((item) => item.clientId !== clientId));
  };

  const saveGeneratedQuestions = async () => {
    if (!selectedTestId) {
      setStatus({ type: "error", text: "Select a test first." });
      return;
    }
    if (!generatedQuestions.length) return;

    setStatus({ type: "", text: "" });
    setSavingGenerated(true);

    let savedCount = 0;
    const failed = [];

    try {
      for (const question of generatedQuestions) {
        try {
          await API.post(`/questions/test/${selectedTestId}`, {
            text: question.text,
            options: question.options,
            correctAnswer: question.correctAnswer,
            marks: question.marks,
            topic: question.topic,
            aiReview: question.aiReview,
          });
          savedCount += 1;
        } catch (err) {
          failed.push({
            question,
            error: err.response?.data?.message || "Save failed",
          });
        }
      }

      setGeneratedQuestions(failed.map((row) => row.question));

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

  const togglePublishSelectedTest = async () => {
    if (!selectedTestId) {
      setStatus({ type: "error", text: "Select a test first." });
      return;
    }

    setStatus({ type: "", text: "" });
    setPublishing(true);

    try {
      const res = await API.put(`/tests/${selectedTestId}/publish`);
      setTests((prev) =>
        prev.map((test) =>
          test._id === selectedTestId
            ? { ...test, isPublished: Boolean(res.data?.isPublished) }
            : test
        )
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
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold mb-2">AI Test Creator</h1>
      <p className="text-sm text-gray-600 mb-4">
        Create 10 MCQs from a paragraph, review answers, delete unwanted items,
        save to selected test, then publish.
      </p>

      {status.text ? (
        <p
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            status.type === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <div className="mb-6 rounded border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="rounded border p-2"
            disabled={loadingTests || tests.length === 0}
          >
            {tests.length === 0 ? (
              <option value="">No tests available</option>
            ) : (
              tests.map((test) => (
                <option key={test._id} value={test._id}>
                  {test.title} ({test.subject}) {test.isPublished ? "- Published" : "- Draft"}
                </option>
              ))
            )}
          </select>

          <Link
            to={selectedTestId ? `/teacher/questions?testId=${selectedTestId}` : "/teacher/tests"}
            className="rounded border px-3 py-2 text-center text-sm"
          >
            Open Manual Questions
          </Link>

          <button
            type="button"
            onClick={togglePublishSelectedTest}
            disabled={!selectedTestId || publishing}
            className={`rounded px-3 py-2 text-sm text-white disabled:opacity-60 ${
              selectedTest?.isPublished ? "bg-red-600" : "bg-green-600"
            }`}
          >
            {publishing
              ? "Updating..."
              : selectedTest?.isPublished
              ? "Unpublish Selected Test"
              : "Publish Selected Test"}
          </button>
        </div>
      </div>

      <div className="rounded border bg-white p-5">
        <h2 className="font-semibold mb-2">Paragraph/PDF to MCQ</h2>

        <textarea
          rows={8}
          placeholder="Paste paragraph content here..."
          value={paragraphInput}
          onChange={(e) => setParagraphInput(e.target.value)}
          className="w-full rounded border p-2"
        />

        <div className="mt-3 rounded border border-dashed bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Or upload syllabus PDF
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          {pdfFile ? (
            <p className="mt-1 text-xs text-gray-600">Selected: {pdfFile.name}</p>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            type="text"
            placeholder="Topic (optional)"
            value={autoTopic}
            onChange={(e) => setAutoTopic(e.target.value)}
            className="rounded border p-2"
          />
          <input
            type="number"
            min={AUTO_MCQ_MIN_COUNT}
            max={AUTO_MCQ_MAX_COUNT}
            value={autoCount}
            onChange={(e) => setAutoCount(Number(e.target.value))}
            className="rounded border p-2"
          />
          <input
            type="number"
            min={1}
            max={100}
            value={autoMarks}
            onChange={(e) => setAutoMarks(Number(e.target.value))}
            className="rounded border p-2"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateFromParagraph}
            disabled={loadingGenerate || !selectedTestId}
            className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {loadingGenerate ? "Generating..." : "Generate from Paragraph"}
          </button>

          <button
            type="button"
            onClick={generateFromPdf}
            disabled={loadingGenerate || !selectedTestId}
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
          >
            {loadingGenerate ? "Generating..." : "Generate from PDF"}
          </button>

          <button
            type="button"
            onClick={saveGeneratedQuestions}
            disabled={!generatedQuestions.length || savingGenerated || !selectedTestId}
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

        {generatedQuestions.length > 0 ? (
          <div className="mt-4 space-y-3">
            {generatedQuestions.map((generated, index) => (
              <div key={generated.clientId} className="rounded border bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {index + 1}. {generated.text}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      Topic: {generated.topic} | Marks: {generated.marks} | Correct: Option{" "}
                      {optionLabel(generated.correctAnswer)}
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
                  {generated.options.map((option, optionIndex) => (
                    <li
                      key={`${generated.clientId}-${optionIndex}`}
                      className={`rounded border px-2 py-1 ${
                        generated.correctAnswer === optionIndex
                          ? "border-green-300 bg-green-100"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className="mr-2 font-semibold">{optionLabel(optionIndex)}.</span>
                      {option}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

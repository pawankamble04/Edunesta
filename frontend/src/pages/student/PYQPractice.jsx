import { useState } from "react";
import API from "../../services/api";

const PYQ_EXAMS = ["JEE", "NEET"];
const PYQ_SUBJECTS = {
  JEE: ["Physics", "Chemistry", "Mathematics"],
  NEET: ["Physics", "Chemistry", "Biology"],
};

const currentYear = new Date().getFullYear();

export default function PYQPractice() {
  const [examType, setExamType] = useState("JEE");
  const [subject, setSubject] = useState("");
  const [yearFrom, setYearFrom] = useState(currentYear - 5);
  const [yearTo, setYearTo] = useState(currentYear);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [practice, setPractice] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const subjectOptions = PYQ_SUBJECTS[examType] || [];

  const startPractice = async () => {
    setStatus({ type: "", text: "" });
    setResult(null);
    setAnswers({});
    try {
      setLoading(true);
      const res = await API.post("/analytics/student/pyq-practice", {
        examType,
        subject,
        yearFrom,
        yearTo,
        count,
      });
      const nextPractice = res.data?.practice || null;
      if (!nextPractice || !Array.isArray(nextPractice.questions)) {
        setStatus({
          type: "error",
          text: "Could not generate practice set right now.",
        });
        setPractice(null);
        return;
      }

      setPractice(nextPractice);
      setStatus({
        type: nextPractice.warning ? "warning" : "success",
        text: nextPractice.warning
          ? nextPractice.warning
          : `Generated ${nextPractice.questionCount} questions.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to generate PYQ practice set.",
      });
      setPractice(null);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (questionId, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const submitPractice = async () => {
    if (!practice?.questions?.length) {
      setStatus({ type: "error", text: "Generate PYQ practice first." });
      return;
    }

    const unanswered = practice.questions.filter(
      (question) => !Number.isFinite(Number(answers[question.id]))
    );
    if (unanswered.length > 0) {
      setStatus({
        type: "error",
        text: `Please answer all ${practice.questions.length} questions before submit.`,
      });
      return;
    }

    try {
      setSubmitLoading(true);
      const payload = practice.questions.map((question) => ({
        questionId: question.id,
        selected: Number(answers[question.id]),
      }));
      const res = await API.post("/analytics/student/pyq-practice/submit", {
        answers: payload,
      });
      setResult(res.data?.result || null);
      setStatus({ type: "success", text: "PYQ practice submitted." });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to submit PYQ practice.",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">PYQ Practice Mode (JEE/NEET)</h1>

      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Generate Practice Set</h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={examType}
            onChange={(e) => {
              setExamType(e.target.value);
              setSubject("");
            }}
            className="border rounded px-3 py-2"
          >
            {PYQ_EXAMS.map((exam) => (
              <option key={exam} value={exam}>
                {exam}
              </option>
            ))}
          </select>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Subjects</option>
            {subjectOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1990}
            max={currentYear + 1}
            className="border rounded px-3 py-2"
            value={yearFrom}
            onChange={(e) => setYearFrom(Number(e.target.value))}
            placeholder="From Year"
          />

          <input
            type="number"
            min={1990}
            max={currentYear + 1}
            className="border rounded px-3 py-2"
            value={yearTo}
            onChange={(e) => setYearTo(Number(e.target.value))}
            placeholder="To Year"
          />

          <input
            type="number"
            min={5}
            max={40}
            className="border rounded px-3 py-2"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            placeholder="Questions"
          />
        </div>

        <button
          onClick={startPractice}
          disabled={loading}
          className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Generating..." : "Start PYQ Practice"}
        </button>

        {status.text && (
          <p
            className={`mt-3 text-sm ${
              status.type === "error"
                ? "text-red-600"
                : status.type === "warning"
                  ? "text-amber-700"
                  : "text-green-700"
            }`}
          >
            {status.text}
          </p>
        )}
      </div>

      {practice?.questions?.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {practice.examType} Practice | {practice.questionCount} Questions |{" "}
              {practice.subject || "All"}
            </p>
            <p className="text-xs text-gray-600">
              Year Range: {practice.yearFrom} - {practice.yearTo}
            </p>
          </div>

          {practice.questions.map((question) => (
            <div key={question.id} className="bg-white border rounded p-4">
              <p className="font-medium mb-2">
                {question.order}. {question.text}
              </p>
              <p className="text-xs text-gray-500 mb-2">
                Topic: {question.topic} | Difficulty: {question.difficulty}{" "}
                {question.pyqYear ? `| PYQ Year: ${question.pyqYear}` : ""}
              </p>

              <div className="space-y-2">
                {(question.options || []).map((option, optionIndex) => (
                  <label key={`${question.id}-${optionIndex}`} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={`pyq-${question.id}`}
                      checked={Number(answers[question.id]) === optionIndex}
                      onChange={() => selectAnswer(question.id, optionIndex)}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={submitPractice}
            disabled={submitLoading}
            className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-800 disabled:opacity-60"
          >
            {submitLoading ? "Submitting..." : "Submit Practice"}
          </button>

          {result && (
            <div className="bg-white border rounded p-4">
              <p className="font-semibold">
                Score: {result.scoreText} ({result.accuracy}%)
              </p>

              {(result.topicBreakdown || []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {(result.topicBreakdown || []).map((topic) => (
                    <p key={`topic-${topic.topic}`} className="text-xs">
                      {topic.topic}: {topic.correct}/{topic.attempted} ({topic.accuracy}%)
                    </p>
                  ))}
                </div>
              )}

              {(result.yearBreakdown || []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {(result.yearBreakdown || []).map((year) => (
                    <p key={`year-${year.year || "unknown"}`} className="text-xs">
                      {year.year || "Unknown"}: {year.correct}/{year.attempted} ({year.accuracy}%)
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

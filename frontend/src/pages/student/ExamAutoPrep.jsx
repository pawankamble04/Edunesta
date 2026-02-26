import { useEffect, useState } from "react";
import API from "../../services/api";

const EXAM_AUTO_MONTH_OPTIONS = [1, 2, 3, 6];
const EXAM_AUTO_DAILY_HOUR_OPTIONS = [2, 3, 4, 5, 6, 8];

export default function ExamAutoPrep() {
  const [examAutoType, setExamAutoType] = useState("JEE");
  const [examAutoMonths, setExamAutoMonths] = useState(2);
  const [examAutoDailyHours, setExamAutoDailyHours] = useState(4);
  const [examAutoGoal, setExamAutoGoal] = useState("");
  const [examAutoPlan, setExamAutoPlan] = useState(null);
  const [examAutoPlanHistory, setExamAutoPlanHistory] = useState([]);
  const [examAutoPlanHistoryLoading, setExamAutoPlanHistoryLoading] =
    useState(false);
  const [examAutoPlanLoading, setExamAutoPlanLoading] = useState(false);
  const [examAutoPlanPdfLoading, setExamAutoPlanPdfLoading] = useState(false);
  const [examAutoPlanStatus, setExamAutoPlanStatus] = useState({
    type: "",
    text: "",
  });

  const loadExamAutoPlanHistory = async () => {
    try {
      setExamAutoPlanHistoryLoading(true);
      const res = await API.get("/ai/exam-auto-plan/history");
      const history = Array.isArray(res.data?.history) ? res.data.history : [];
      setExamAutoPlanHistory(history);
      setExamAutoPlan((prev) => {
        if (!history.length) return null;
        if (prev && history.some((item) => item._id === prev._id)) return prev;
        return history[0];
      });
    } catch {
      setExamAutoPlanStatus({
        type: "error",
        text: "Could not load JEE/NEET auto-plan history",
      });
    } finally {
      setExamAutoPlanHistoryLoading(false);
    }
  };

  const downloadExamAutoPlanPdf = async (plan) => {
    if (!plan?._id) return;
    try {
      setExamAutoPlanPdfLoading(true);
      const res = await API.get(`/ai/exam-auto-plan/${plan._id}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeExam = String(plan.examType || "exam").toLowerCase();
      const duration = Number(plan.durationMonths) || examAutoMonths;
      link.href = url;
      link.download = `${safeExam}-auto-plan-${duration}m.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExamAutoPlanStatus({
        type: "error",
        text: err.response?.data?.error || "Failed to download auto-plan PDF",
      });
    } finally {
      setExamAutoPlanPdfLoading(false);
    }
  };

  const generateExamAutoPlan = async () => {
    setExamAutoPlanStatus({ type: "", text: "" });
    try {
      setExamAutoPlanLoading(true);
      const res = await API.post("/ai/exam-auto-plan", {
        examType: examAutoType,
        durationMonths: Number(examAutoMonths) || 2,
        dailyHours: Number(examAutoDailyHours) || 4,
        goal: examAutoGoal,
      });
      const plan = res.data?.plan || null;
      if (!plan) {
        setExamAutoPlanStatus({
          type: "error",
          text: "Auto-plan could not be generated right now.",
        });
        return;
      }

      setExamAutoPlan(plan);
      setExamAutoPlanHistory((prev) => {
        const filtered = prev.filter((item) => item._id !== plan._id);
        return [plan, ...filtered].slice(0, 20);
      });
      setExamAutoPlanStatus({
        type: "success",
        text:
          res.data?.source === "fallback" && res.data?.warning
            ? `Auto-plan generated (${res.data.warning})`
            : `${plan.examType} auto-plan generated successfully.`,
      });
    } catch (err) {
      setExamAutoPlanStatus({
        type: "error",
        text: err.response?.data?.error || "Failed to generate JEE/NEET auto-plan",
      });
    } finally {
      setExamAutoPlanLoading(false);
    }
  };

  useEffect(() => {
    void loadExamAutoPlanHistory();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">JEE/NEET Smart Prep (Auto Mode)</h1>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">Auto Mode Planner</h2>
            <p className="text-sm text-gray-600">
              Auto mode uses your recent tests and weak topics to generate a focused
              plan, retest loop, and mock schedule.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateExamAutoPlan}
              disabled={examAutoPlanLoading}
              className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-60"
            >
              {examAutoPlanLoading ? "Generating..." : "Generate Auto Plan"}
            </button>
            <button
              onClick={() => downloadExamAutoPlanPdf(examAutoPlan)}
              disabled={!examAutoPlan?._id || examAutoPlanPdfLoading}
              className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-60"
            >
              {examAutoPlanPdfLoading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <select
            value={examAutoType}
            onChange={(e) => setExamAutoType(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="JEE">JEE</option>
            <option value="NEET">NEET</option>
          </select>

          <select
            value={examAutoMonths}
            onChange={(e) => setExamAutoMonths(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            {EXAM_AUTO_MONTH_OPTIONS.map((month) => (
              <option key={month} value={month}>
                {month} Month{month > 1 ? "s" : ""}
              </option>
            ))}
          </select>

          <select
            value={examAutoDailyHours}
            onChange={(e) => setExamAutoDailyHours(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            {EXAM_AUTO_DAILY_HOUR_OPTIONS.map((hours) => (
              <option key={hours} value={hours}>
                {hours} Hour{hours > 1 ? "s" : ""}/Day
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={2}
          value={examAutoGoal}
          onChange={(e) => setExamAutoGoal(e.target.value)}
          placeholder="Optional goal (example: JEE Mains + strong Physics accuracy)"
          className="w-full border rounded px-3 py-2 mb-3"
        />

        {examAutoPlanStatus.text && (
          <p
            className={`text-sm mb-3 ${
              examAutoPlanStatus.type === "error"
                ? "text-red-600"
                : "text-green-700"
            }`}
          >
            {examAutoPlanStatus.text}
          </p>
        )}

        {examAutoPlan && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              Exam: {examAutoPlan.examType} | Duration: {examAutoPlan.durationMonths} month(s) |
              Daily: {examAutoPlan.dailyHours} hour(s) | Avg:{" "}
              {examAutoPlan.summaryAverageScore ?? 0}% | Created:{" "}
              {examAutoPlan.createdAt
                ? new Date(examAutoPlan.createdAt).toLocaleDateString()
                : "-"}
            </p>
            {(examAutoPlan.weakSubjects || []).length > 0 && (
              <p className="text-xs text-orange-700">
                Weak Subjects: {(examAutoPlan.weakSubjects || []).join(", ")}
              </p>
            )}
            {(examAutoPlan.weakTopics || []).length > 0 && (
              <p className="text-xs text-amber-700">
                Weak Topics: {(examAutoPlan.weakTopics || []).join(", ")}
              </p>
            )}
            <pre className="text-sm whitespace-pre-wrap text-gray-800 bg-white border rounded p-3">
              {examAutoPlan.planText}
            </pre>
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Auto-Plan History</h3>
          {examAutoPlanHistoryLoading ? (
            <p className="text-sm text-gray-500">Loading auto-plan history...</p>
          ) : examAutoPlanHistory.length === 0 ? (
            <p className="text-sm text-gray-500">
              No auto-plan history yet. Generate one to save it.
            </p>
          ) : (
            <div className="space-y-2">
              {examAutoPlanHistory.slice(0, 8).map((item) => (
                <div
                  key={item._id}
                  className="bg-white border rounded px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                >
                  <p className="text-sm">
                    {item.examType} | {item.durationMonths} month(s) | {item.dailyHours}h/day |{" "}
                    Avg: {item.summaryAverageScore ?? 0}% |{" "}
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExamAutoPlan(item)}
                      className="text-sm text-orange-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => downloadExamAutoPlanPdf(item)}
                      className="text-sm text-slate-700"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

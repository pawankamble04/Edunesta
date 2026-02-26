import { useEffect, useState } from "react";
import API from "../../services/api";

export default function ParentExamPrepSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [children, setChildren] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [activePlan, setActivePlan] = useState(null);

  const loadOverview = async (studentId = "") => {
    try {
      setLoading(true);
      const res = await API.get("/ai/exam-auto-plan/parent/overview", {
        params: studentId ? { studentId } : undefined,
      });

      const childList = Array.isArray(res.data?.children) ? res.data.children : [];
      const selectedId = String(res.data?.selectedStudentId || "");
      const planHistory = Array.isArray(res.data?.history) ? res.data.history : [];

      setChildren(childList);
      setSelectedStudentId(selectedId);
      setSelectedStudent(res.data?.selectedStudent || null);
      setWeeklySummary(res.data?.weeklySummary || null);
      setHistory(planHistory);
      setActivePlan(planHistory[0] || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load prep summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleChangeChild = async (nextStudentId) => {
    setSelectedStudentId(nextStudentId);
    await loadOverview(nextStudentId);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">JEE/NEET Prep Summary</h1>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {children.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <label className="text-sm font-medium">Select Child</label>
          <select
            value={selectedStudentId}
            onChange={(e) => void handleChangeChild(e.target.value)}
            className="mt-2 border rounded px-3 py-2 w-full md:w-80"
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name} ({child.email || "no email"})
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading prep summary...</p>
      ) : !selectedStudent ? (
        <p className="text-sm text-gray-500">
          No linked child with exam prep plans yet.
        </p>
      ) : (
        <>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-2">
              Weekly Snapshot: {selectedStudent.name}
            </h2>

            {!weeklySummary ? (
              <p className="text-sm text-gray-600">
                No weekly summary yet. Child needs to generate first JEE/NEET auto-plan.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                <p>
                  Exam: <span className="font-medium">{weeklySummary.examType}</span>
                </p>
                <p>
                  Daily Hours: <span className="font-medium">{weeklySummary.dailyHours}</span>
                </p>
                <p>
                  Weekly Target Hours:{" "}
                  <span className="font-medium">{weeklySummary.weeklyTargetHours}</span>
                </p>
                <p>
                  Average Score Signal:{" "}
                  <span className="font-medium">{weeklySummary.averageScore ?? 0}%</span>
                </p>
                <p>
                  Weak Subjects:{" "}
                  <span className="font-medium">
                    {(weeklySummary.weakSubjects || []).join(", ") || "-"}
                  </span>
                </p>
                <p>
                  Weak Topics:{" "}
                  <span className="font-medium">
                    {(weeklySummary.weakTopics || []).join(", ") || "-"}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Recent Plans</h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">No plan history yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => setActivePlan(item)}
                      className="w-full text-left border rounded px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      {item.examType} | {item.durationMonths} month(s) | {item.dailyHours}h/day |{" "}
                      Avg {item.summaryAverageScore ?? 0}% |{" "}
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Plan Details</h3>
              {!activePlan ? (
                <p className="text-sm text-gray-500">Select a plan to view details.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    {activePlan.examType} | {activePlan.durationMonths} month(s) |{" "}
                    {activePlan.dailyHours}h/day |{" "}
                    {activePlan.createdAt
                      ? new Date(activePlan.createdAt).toLocaleDateString()
                      : "-"}
                  </p>
                  <pre className="text-sm whitespace-pre-wrap bg-gray-50 border rounded p-3">
                    {activePlan.planText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

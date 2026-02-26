import { useState } from "react";
import API from "../../services/api";
import useVisiblePolling from "../../utils/useVisiblePolling";

const TEACHER_EXAM_PREP_REFRESH_MS = 20_000;

export default function TeacherExamPrepTracking() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    connectedStudents: 0,
    studentsWithPlans: 0,
    avgPlanScore: 0,
    jeePlans: 0,
    neetPlans: 0,
  });
  const [students, setStudents] = useState([]);

  const loadOverview = async () => {
    try {
      const res = await API.get("/ai/exam-auto-plan/teacher/overview");
      setStats(res.data?.stats || {});
      setStudents(Array.isArray(res.data?.students) ? res.data.students : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load exam prep tracking");
    } finally {
      setLoading(false);
    }
  };

  useVisiblePolling(loadOverview, TEACHER_EXAM_PREP_REFRESH_MS);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">JEE/NEET Prep Tracking</h1>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Stat title="Connected Students" value={stats.connectedStudents || 0} />
        <Stat title="Plans Active" value={stats.studentsWithPlans || 0} />
        <Stat title="Avg Plan Score" value={`${stats.avgPlanScore ?? 0}%`} />
        <Stat title="JEE Plans" value={stats.jeePlans || 0} />
        <Stat title="NEET Plans" value={stats.neetPlans || 0} />
      </div>

      <div className="bg-white border rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-3">Student Prep Snapshot</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Loading tracking data...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-500">
            No connected students found. Connect students first.
          </p>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <div key={student.studentId} className="border rounded p-3">
                <p className="font-medium">
                  {student.name}{" "}
                  <span className="text-sm font-normal text-gray-600">
                    ({student.email || "no email"})
                  </span>
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Subjects: {(student.subjects || []).join(", ") || "-"} | Plans:{" "}
                  {student.planCount || 0}
                </p>

                {!student.latestPlan ? (
                  <p className="text-sm text-gray-500">
                    No JEE/NEET auto-plan generated yet.
                  </p>
                ) : (
                  <>
                    <p className="text-sm">
                      {student.latestPlan.examType} | {student.latestPlan.durationMonths} month(s) |{" "}
                      {student.latestPlan.dailyHours}h/day | Avg:{" "}
                      {student.latestPlan.summaryAverageScore ?? 0}% | Generated:{" "}
                      {student.latestPlan.createdAt
                        ? new Date(student.latestPlan.createdAt).toLocaleDateString()
                        : "-"}
                    </p>
                    {(student.latestPlan.weakSubjects || []).length > 0 && (
                      <p className="text-xs text-orange-700 mt-1">
                        Weak Subjects: {(student.latestPlan.weakSubjects || []).join(", ")}
                      </p>
                    )}
                    {(student.latestPlan.weakTopics || []).length > 0 && (
                      <p className="text-xs text-amber-700 mt-1">
                        Weak Topics: {(student.latestPlan.weakTopics || []).slice(0, 5).join(", ")}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

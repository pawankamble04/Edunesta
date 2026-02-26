import { Link } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import API from "../../services/api";
import useAI from "../../utils/useAI";
import useVisiblePolling from "../../utils/useVisiblePolling";
import RoleStudyBuddyChat from "../../components/ai/RoleStudyBuddyChat";

const STUDENT_DASHBOARD_REFRESH_MS = 15_000;
const AI_REFRESH_MIN_INTERVAL_MS = 120_000;
const TOPIC_MASTERY_REFRESH_MS = 60_000;
const MICRO_RETEST_QUESTION_COUNT = 5;

const normalizeSubject = (value) => {
  const subject = String(value || "").trim().toLowerCase();
  if (["math", "maths", "mathematics"].includes(subject)) return "math";
  return subject;
};

const getMasteryTextClass = (level) => {
  if (level === "Mastered") return "text-green-700";
  if (level === "Developing") return "text-amber-700";
  return "text-red-700";
};

const getMasteryBarClass = (level) => {
  if (level === "Mastered") return "bg-green-500";
  if (level === "Developing") return "bg-amber-500";
  return "bg-red-500";
};

export default function StudentDashboard() {
  const [aiPlan, setAiPlan] = useState(null);
  const [stats, setStats] = useState(null);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [dailyStatusError, setDailyStatusError] = useState("");
  const [parentLinkCode, setParentLinkCode] = useState("");
  const [codeExpiresAt, setCodeExpiresAt] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeStatus, setCodeStatus] = useState({
    type: "",
    text: "",
  });

  const [subjects, setSubjects] = useState([]);
  const [tests, setTests] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [weeklyPlanHistory, setWeeklyPlanHistory] = useState([]);
  const [weeklyPlanLoading, setWeeklyPlanLoading] = useState(false);
  const [weeklyPlanStatus, setWeeklyPlanStatus] = useState({
    type: "",
    text: "",
  });
  const [topicMastery, setTopicMastery] = useState(null);
  const [topicMasteryLoading, setTopicMasteryLoading] = useState(true);
  const [topicMasteryError, setTopicMasteryError] = useState("");
  const [microRetest, setMicroRetest] = useState(null);
  const [microRetestLoading, setMicroRetestLoading] = useState(false);
  const [microRetestError, setMicroRetestError] = useState("");
  const [microAnswers, setMicroAnswers] = useState({});
  const [microSubmitLoading, setMicroSubmitLoading] = useState(false);
  const [microResult, setMicroResult] = useState(null);
  const lastAiSignatureRef = useRef("");
  const lastAiRefreshAtRef = useRef(0);

  const { loading, error, runAI } = useAI();

  const loadWeeklyPlanHistory = async () => {
    try {
      const res = await API.get("/ai/weekly-plan/history");
      const history = res.data?.history || [];
      setWeeklyPlanHistory(history);
      setWeeklyPlan((prev) => {
        if (!history.length) return null;
        if (prev && history.some((item) => item._id === prev._id)) {
          return prev;
        }
        return history[0];
      });
    } catch {
      setWeeklyPlanStatus({
        type: "error",
        text: "Could not load weekly plan history",
      });
    }
  };

  const generateWeeklyPlan = async () => {
    setWeeklyPlanStatus({ type: "", text: "" });
    try {
      setWeeklyPlanLoading(true);
      const res = await API.post("/ai/weekly-plan");
      const plan = res.data?.plan || null;
      if (plan) {
        setWeeklyPlan(plan);
        setWeeklyPlanHistory((prev) => [plan, ...prev].slice(0, 12));
        setWeeklyPlanStatus({
          type: "success",
          text: "Weekly study plan generated.",
        });
      }
    } catch (err) {
      setWeeklyPlanStatus({
        type: "error",
        text: err.response?.data?.error || "Failed to generate weekly plan",
      });
    } finally {
      setWeeklyPlanLoading(false);
    }
  };

  const generateParentLinkCode = async () => {
    setCodeStatus({ type: "", text: "" });
    try {
      setCodeLoading(true);
      const res = await API.post("/auth/students/link-code");
      const code = res.data?.code || "";
      const expiresInMinutes = Number(res.data?.expiresInMinutes || 10);
      setParentLinkCode(code);
      setCodeExpiresAt(Date.now() + expiresInMinutes * 60 * 1000);
      setCodeStatus({
        type: "success",
        text: "New code generated. Share it with parent before expiry.",
      });
    } catch (err) {
      setCodeStatus({
        type: "error",
        text: err.response?.data?.msg || "Failed to generate code",
      });
    } finally {
      setCodeLoading(false);
    }
  };

  const copyParentCode = async () => {
    if (!parentLinkCode) return;
    setCodeStatus({ type: "", text: "" });
    try {
      await navigator.clipboard.writeText(parentLinkCode);
      setCodeStatus({ type: "success", text: "Code copied." });
    } catch {
      setCodeStatus({ type: "error", text: "Could not copy code." });
    }
  };

  const loadTopicMastery = async () => {
    try {
      if (!topicMastery) {
        setTopicMasteryLoading(true);
      }
      setTopicMasteryError("");
      const res = await API.get("/analytics/student/topic-mastery");
      setTopicMastery({
        topics: Array.isArray(res.data?.topics) ? res.data.topics : [],
        weakTopics: Array.isArray(res.data?.weakTopics) ? res.data.weakTopics : [],
      });
    } catch (err) {
      setTopicMasteryError(
        err.response?.data?.message || "Failed to load topic mastery"
      );
    } finally {
      setTopicMasteryLoading(false);
    }
  };

  const generateMicroRetest = async () => {
    try {
      setMicroRetestLoading(true);
      setMicroRetestError("");
      setMicroResult(null);
      setMicroAnswers({});

      const suggestedTopics = (topicMastery?.weakTopics || [])
        .slice(0, 3)
        .map((topic) => topic.topic);

      const res = await API.post("/analytics/student/micro-retest", {
        count: MICRO_RETEST_QUESTION_COUNT,
        topics: suggestedTopics,
      });

      const retest = res.data?.retest || null;
      if (!retest || !Array.isArray(retest.questions) || retest.questions.length === 0) {
        setMicroRetestError("Micro-retest could not be generated right now.");
        setMicroRetest(null);
        return;
      }

      setMicroRetest(retest);

      if (res.data?.mastery) {
        setTopicMastery({
          topics: Array.isArray(res.data.mastery.topics)
            ? res.data.mastery.topics
            : topicMastery?.topics || [],
          weakTopics: Array.isArray(res.data.mastery.weakTopics)
            ? res.data.mastery.weakTopics
            : topicMastery?.weakTopics || [],
        });
      }
    } catch (err) {
      setMicroRetestError(
        err.response?.data?.message || "Failed to generate micro-retest"
      );
      setMicroRetest(null);
    } finally {
      setMicroRetestLoading(false);
    }
  };

  const selectMicroAnswer = (questionId, selectedIndex) => {
    setMicroAnswers((prev) => ({
      ...prev,
      [questionId]: selectedIndex,
    }));
  };

  const submitMicroRetest = async () => {
    if (!microRetest || !Array.isArray(microRetest.questions)) {
      setMicroRetestError("Generate a micro-retest first.");
      return;
    }

    const unanswered = microRetest.questions.filter(
      (question) => !Number.isFinite(Number(microAnswers[question.id]))
    );

    if (unanswered.length > 0) {
      setMicroRetestError(
        `Please answer all ${microRetest.questions.length} questions before submitting.`
      );
      return;
    }

    try {
      setMicroSubmitLoading(true);
      setMicroRetestError("");
      const answers = microRetest.questions.map((question) => ({
        questionId: question.id,
        selected: Number(microAnswers[question.id]),
      }));
      const res = await API.post("/analytics/student/micro-retest/submit", {
        answers,
      });
      setMicroResult(res.data?.result || null);
      await loadTopicMastery();
    } catch (err) {
      setMicroRetestError(
        err.response?.data?.message || "Failed to submit micro-retest"
      );
    } finally {
      setMicroSubmitLoading(false);
    }
  };

  /* ===============================
     FETCH DASHBOARD DATA
  =============================== */
  const refreshDashboard = async () => {
    try {
      const [subRes, teacherRes, testRes, dailyRes] = await Promise.all([
        API.get("/submissions/my"),
        API.get("/enrollments/teachers"),
        API.get("/tests"),
        API.get("/submissions/daily-status"),
      ]);

      const subs = Array.isArray(subRes.data) ? subRes.data : [];
      const teacherList = Array.isArray(teacherRes.data) ? teacherRes.data : [];
      const testList = Array.isArray(testRes.data) ? testRes.data : [];
      const todaySummary = dailyRes.data?.summary || null;

      setSubmissions(subs);
      setSubjects(teacherList);
      setTests(testList);
      setDailyStatus(todaySummary);
      setDailyStatusError("");

      await loadWeeklyPlanHistory();

      if (!subs.length) {
        setStats({
          attempts: 0,
          averageScore: 0,
          bestScore: "0%",
          pending: testList.length,
          lastAttempt: "-",
        });
        setAiPlan(null);
        return;
      }

      let totalPercentage = 0;
      let validAttempts = 0;
      let bestScorePercent = 0;
      let latestDate = null;

      subs.forEach((s) => {
        const percentage =
          typeof s.percentage === "number" ? s.percentage : 0;
        totalPercentage += percentage;
        validAttempts++;

        if (percentage > bestScorePercent) {
          bestScorePercent = percentage;
        }

        const submissionDate = s.submittedAt || s.date;
        if (!latestDate || new Date(submissionDate) > new Date(latestDate)) {
          latestDate = submissionDate;
        }
      });

      const average = validAttempts
        ? Math.round(totalPercentage / validAttempts)
        : 0;

      const pending =
        testList.length - subs.length > 0
          ? testList.length - subs.length
          : 0;

      const computedStats = {
        attempts: subs.length,
        averageScore: average,
        bestScore: `${Math.round(bestScorePercent)}%`,
        pending,
        lastAttempt: latestDate
          ? new Date(latestDate).toLocaleDateString()
          : "-",
      };

      setStats(computedStats);

      const aiSignature = `${computedStats.attempts}|${computedStats.averageScore}|${computedStats.pending}|${computedStats.lastAttempt}`;
      const now = Date.now();
      const shouldRefreshAi =
        aiSignature !== lastAiSignatureRef.current ||
        now - lastAiRefreshAtRef.current >= AI_REFRESH_MIN_INTERVAL_MS;

      if (!shouldRefreshAi) return;

      try {
        await runAI(async () => {
          const aiRes = await API.post("/ai/next-steps", {
            stats: computedStats,
          });
          setAiPlan(aiRes.data.suggestions || aiRes.data);
        });
        lastAiSignatureRef.current = aiSignature;
        lastAiRefreshAtRef.current = Date.now();
      } catch {
        // Error state is managed by useAI.
      }
    } catch (err) {
      console.error("Student dashboard error", err);
      setDailyStatusError(
        err.response?.data?.message || "Failed to load daily status"
      );
    }
  };

  useVisiblePolling(refreshDashboard, STUDENT_DASHBOARD_REFRESH_MS);
  useVisiblePolling(loadTopicMastery, TOPIC_MASTERY_REFRESH_MS);

  /* ===============================
     SUBJECT CARDS
  =============================== */
  const subjectCards = useMemo(() => {
    return subjects.map((s) => {
      const count = tests.filter(
        (t) => normalizeSubject(t.subject) === normalizeSubject(s.subject)
      ).length;

      return {
        ...s,
        testCount: count,
      };
    });
  }, [subjects, tests]);

  return (
    <div className="space-y-10">

      {/* ================= OVERVIEW ================= */}
      <div>
        <h1 className="text-2xl font-bold mb-6">
          Student Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card title="Tests Attempted" value={stats?.attempts || 0} />
          <Card
            title="Average Score"
            value={stats ? `${stats.averageScore}%` : "-"}
          />
          <Card title="Best Score" value={stats?.bestScore || 0} />
          <Card title="Pending Tests" value={stats?.pending || 0} />
          <Card title="Last Attempt" value={stats?.lastAttempt || "-"} />
        </div>
      </div>

      {/* ================= PARENT LINK CODE ================= */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">
          Parent Connect Code
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Generate a 6-digit code and share it with your parent to link accounts.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generateParentLinkCode}
            disabled={codeLoading}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {codeLoading ? "Generating..." : "Generate Code"}
          </button>

          {parentLinkCode && (
            <>
              <div className="bg-white border rounded px-4 py-2 text-xl font-bold tracking-widest">
                {parentLinkCode}
              </div>
              <button
                onClick={copyParentCode}
                className="border border-indigo-300 text-indigo-700 px-3 py-2 rounded hover:bg-indigo-100"
              >
                Copy
              </button>
            </>
          )}
        </div>

        {codeExpiresAt && (
          <p className="text-xs text-gray-500 mt-3">
            Expires at: {new Date(codeExpiresAt).toLocaleTimeString()}
          </p>
        )}
        {codeStatus.text && (
          <p
            className={`text-sm mt-2 ${
              codeStatus.type === "error" ? "text-red-600" : "text-green-700"
            }`}
          >
            {codeStatus.text}
          </p>
        )}
      </div>

      {/* ================= DAILY STATUS ================= */}
      <div className="bg-white border rounded-lg p-6 shadow">
        <h2 className="text-lg font-semibold mb-2">
          Daily Status
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Today only. No history, alerts, or notifications.
        </p>

        {dailyStatusError && (
          <p className="text-sm text-red-600 mb-3">{dailyStatusError}</p>
        )}

        {!dailyStatus ? (
          <p className="text-sm text-gray-500">Loading today&apos;s summary...</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              Attendance:{" "}
              <span
                className={
                  dailyStatus.attendance === "Present"
                    ? "text-green-700 font-medium"
                    : "text-red-700 font-medium"
                }
              >
                {dailyStatus.attendance}
              </span>
            </p>
            <p>
              Test Marks:{" "}
              <span className="font-medium">
                {typeof dailyStatus.testMarks === "number"
                  ? `${dailyStatus.testMarks}`
                  : "No test today"}
              </span>
            </p>
            <p>
              Average:{" "}
              <span className="font-medium">{dailyStatus.average ?? 0}%</span>
            </p>
          </div>
        )}
      </div>

      {/* ================= SUBJECTS ================= */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          My Subjects
        </h2>

        {subjectCards.length === 0 && (
          <div className="bg-white border rounded-lg p-6 text-center">
            <p className="text-gray-500 mb-4">
              No subjects connected yet.
            </p>

            <Link
              to="/student/connect"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Connect to Teacher
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subjectCards.map((s) => (
            <div
              key={s.id + s.subject}
              className="bg-white rounded-lg shadow p-6 border"
            >
              <h3 className="text-lg font-semibold">
                {s.subject}
              </h3>

              <p className="text-sm text-gray-600 mt-1">
                Teacher: {s.name}
              </p>

              <p className="text-sm text-blue-600 mt-2 font-medium">
                Available Tests: {s.testCount}
              </p>

              <Link
                to={`/student/tests?subject=${encodeURIComponent(
                  s.subject
                )}`}
                className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                View Tests
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ================= TOPIC MASTERY + MICRO RETEST ================= */}
      <div className="bg-white border rounded-lg p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">
              Topic Mastery Map + Adaptive Micro-Retest
            </h2>
            <p className="text-sm text-gray-600">
              Track weak topics and practice with a targeted{" "}
              {MICRO_RETEST_QUESTION_COUNT}-question mini test.
            </p>
          </div>
          <button
            onClick={generateMicroRetest}
            disabled={
              microRetestLoading ||
              topicMasteryLoading ||
              !(topicMastery?.topics || []).length
            }
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
          >
            {microRetestLoading
              ? "Generating..."
              : `Generate ${MICRO_RETEST_QUESTION_COUNT}Q Retest`}
          </button>
        </div>

        {topicMasteryError && (
          <p className="text-sm text-red-600 mb-3">{topicMasteryError}</p>
        )}

        {topicMasteryLoading && !topicMastery ? (
          <p className="text-sm text-gray-500 mb-3">Loading topic mastery...</p>
        ) : (topicMastery?.topics || []).length === 0 ? (
          <p className="text-sm text-gray-500 mb-3">
            Attempt tests to unlock topic mastery insights.
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {(topicMastery.topics || []).map((topic) => (
              <div key={topic.topic} className="rounded border p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-medium">{topic.topic}</p>
                  <p
                    className={`text-sm font-semibold ${getMasteryTextClass(
                      topic.level
                    )}`}
                  >
                    {topic.masteryPercent}% ({topic.level})
                  </p>
                </div>
                <div className="h-2 rounded bg-gray-200">
                  <div
                    className={`h-2 rounded ${getMasteryBarClass(topic.level)}`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, Number(topic.masteryPercent) || 0)
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Attempts: {topic.attempted || 0} | Correct: {topic.correct || 0}
                </p>
              </div>
            ))}
          </div>
        )}

        {(topicMastery?.weakTopics || []).length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Weak Topics
            </p>
            <div className="flex flex-wrap gap-2">
              {(topicMastery.weakTopics || []).map((topic) => (
                <span
                  key={`weak-${topic.topic}`}
                  className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium"
                >
                  {topic.topic} ({topic.masteryPercent}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {microRetestError && (
          <p className="text-sm text-red-600 mb-3">{microRetestError}</p>
        )}

        {microRetest?.questions?.length > 0 && (
          <div className="rounded-lg border bg-indigo-50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-indigo-900">
                Micro-Retest ({microRetest.questionCount} Questions)
              </p>
              {(microRetest.targetTopics || []).length > 0 && (
                <p className="text-xs text-indigo-700">
                  Topics: {(microRetest.targetTopics || []).join(", ")}
                </p>
              )}
            </div>

            {(microRetest.questions || []).map((question) => (
              <div key={question.id} className="rounded border bg-white p-3">
                <p className="text-sm font-medium mb-1">
                  {question.order}. {question.text}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Topic: {question.topic} | Difficulty: {question.difficulty}
                </p>

                <div className="space-y-2">
                  {(question.options || []).map((option, optionIndex) => (
                    <label
                      key={`${question.id}-${optionIndex}`}
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        name={`micro-retest-${question.id}`}
                        checked={
                          Number(microAnswers[question.id]) === optionIndex
                        }
                        onChange={() =>
                          selectMicroAnswer(question.id, optionIndex)
                        }
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={submitMicroRetest}
              disabled={microSubmitLoading}
              className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-800 disabled:opacity-60"
            >
              {microSubmitLoading ? "Submitting..." : "Submit Retest"}
            </button>

            {microResult && (
              <div className="rounded border bg-white p-3">
                <p className="text-sm font-semibold text-gray-900">
                  Score: {microResult.scoreText} ({microResult.accuracy}%)
                </p>

                {(microResult.topicBreakdown || []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(microResult.topicBreakdown || []).map((topic) => (
                      <p key={`micro-result-${topic.topic}`} className="text-xs">
                        {topic.topic}: {topic.correct}/{topic.attempted} (
                        {topic.accuracy}%)
                      </p>
                    ))}
                  </div>
                )}

                {(microResult.weakTopics || []).length > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    Focus next: {(microResult.weakTopics || []).join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= WEEKLY PLAN ================= */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">AI Weekly Study Plan</h2>
          <button
            onClick={generateWeeklyPlan}
            disabled={weeklyPlanLoading}
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-60"
          >
            {weeklyPlanLoading ? "Generating..." : "Generate Weekly Plan"}
          </button>
        </div>

        {weeklyPlanStatus.text && (
          <p
            className={`text-sm mb-3 ${
              weeklyPlanStatus.type === "error"
                ? "text-red-600"
                : "text-green-700"
            }`}
          >
            {weeklyPlanStatus.text}
          </p>
        )}

        {weeklyPlan ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Week: {new Date(weeklyPlan.weekStart).toLocaleDateString()} -{" "}
              {new Date(weeklyPlan.weekEnd).toLocaleDateString()}
            </p>
            <pre className="text-sm whitespace-pre-wrap text-gray-800 bg-white border rounded p-3">
              {weeklyPlan.planText}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No weekly plan yet. Generate one from your recent test performance.
          </p>
        )}

        {weeklyPlanHistory.length > 1 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Recent Plans</h3>
            <div className="space-y-2">
              {weeklyPlanHistory.slice(1, 6).map((item) => (
                <button
                  key={item._id}
                  onClick={() => setWeeklyPlan(item)}
                  className="w-full text-left border rounded px-3 py-2 bg-white hover:bg-gray-50 text-sm"
                >
                  {new Date(item.weekStart).toLocaleDateString()} -{" "}
                  {new Date(item.weekEnd).toLocaleDateString()} | Avg:{" "}
                  {item.summary?.averageScore ?? 0}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= AI SECTION ================= */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">
          AI Academic Insights
        </h2>

        {loading && (
          <p className="text-sm text-gray-600">
            AI analyzing performance...
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        {!loading && aiPlan && (
          <pre className="text-sm whitespace-pre-wrap text-gray-800">
            {typeof aiPlan === "string"
              ? aiPlan
              : JSON.stringify(aiPlan, null, 2)}
          </pre>
        )}
      </div>

      <RoleStudyBuddyChat role="student" />

    </div>
  );
}

/* ================= REUSABLE CARD ================= */

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

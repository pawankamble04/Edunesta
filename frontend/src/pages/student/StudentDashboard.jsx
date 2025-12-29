import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../../services/api";
import { getUser } from "../../utils/auth";
import useAI from "../../utils/useAI";

export default function StudentDashboard() {
  const [aiPlan, setAiPlan] = useState(null);
  const [stats, setStats] = useState(null);

  const { loading, error, runAI } = useAI();

  /* -----------------------------------
     FETCH REAL STUDENT STATS + AI GUIDANCE
  ------------------------------------*/
  useEffect(() => {
    const fetchStatsAndAI = async () => {
      const user = getUser();

      try {
        // 1️⃣ Fetch student submissions
        const res = await API.get("/submissions/my");
        const submissions = res.data || [];

        if (submissions.length === 0) {
          setStats(null);
          setAiPlan(null);
          return;
        }

        // 2️⃣ Calculate stats
        let totalScore = 0;
        let maxScore = 0;

        submissions.forEach((s) => {
          totalScore += s.score;
          maxScore += s.test?.questions?.length || 10;
        });

        const percentage = Math.round(
          (totalScore / (maxScore || 1)) * 100
        );

        // 3️⃣ Skill level detection
        let level = "Beginner";
        if (percentage >= 40 && percentage < 70)
          level = "Intermediate";
        if (percentage >= 70) level = "Advanced";

        const computedStats = {
          studentId: user?.id,
          attempts: submissions.length,
          averageScore: percentage,
          level,
          recentPerformance:
            percentage >= 70 ? "Strong" : "Needs Improvement",
          goal: "Improve academic performance",
        };

        setStats(computedStats);

        // 4️⃣ Call AI safely
        await runAI(async () => {
          const aiRes = await API.post("/ai/next-steps", {
            stats: computedStats,
          });
          setAiPlan(aiRes.data.suggestions || aiRes.data);
        });
      } catch (err) {
        console.error("Student dashboard error", err);
      }
    };

    fetchStatsAndAI();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Student Dashboard
      </h1>

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card title="Attempts" value={stats?.attempts || 0} />
        <Card
          title="Avg Score"
          value={stats ? `${stats.averageScore}%` : "-"}
        />
        <Card title="Level" value={stats?.level || "-"} />
        <Card
          title="Status"
          value={stats?.recentPerformance || "-"}
        />
      </div>

      {/* ================= AI GUIDANCE ================= */}
      <div className="mb-8">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">
            🎯 Personalized AI Guidance
          </h2>

          {loading && (
            <p className="text-sm text-gray-600">
              AI is analyzing your performance...
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 mt-2">
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

          {!loading && !aiPlan && (
            <p className="text-sm text-gray-500">
              Attempt tests to unlock AI-powered guidance.
            </p>
          )}
        </div>
      </div>

      {/* ================= ACTIONS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActionCard
          title="Take a Test"
          description="Attempt available tests"
          link="/student/tests"
          btn="Start"
        />
        <ActionCard
          title="Study Materials"
          description="Access learning resources"
          link="/student/materials"
          btn="View"
        />
      </div>
    </div>
  );
}

/* ================= REUSABLE COMPONENTS ================= */

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function ActionCard({ title, description, link, btn }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">
          {description}
        </p>
      </div>

      <Link
        to={link}
        className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-fit"
      >
        {btn}
      </Link>
    </div>
  );
}

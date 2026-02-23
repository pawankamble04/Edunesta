import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import API from "../../services/api";
import useVisiblePolling from "../../utils/useVisiblePolling";

const PARENT_RESULTS_REFRESH_MS = 15_000;
const PARENT_AI_SUMMARY_REFRESH_MS = 60_000;

export default function ParentResults() {
  const { studentId } = useParams();

  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const aiStrengths = Array.isArray(aiSummary?.ai?.strengths)
    ? aiSummary.ai.strengths
    : [];
  const aiWeaknesses = Array.isArray(aiSummary?.ai?.weaknesses)
    ? aiSummary.ai.weaknesses
    : [];
  const aiRecommendations = Array.isArray(aiSummary?.ai?.recommendations)
    ? aiSummary.ai.recommendations
    : [];

  const fetchResults = async () => {
    try {
      const res = await API.get(`/parents/results/${studentId}`);
      setStudent(res.data.student);
      setResults(res.data.results || []);
    } catch {
      setError("Failed to load student results");
    }
  };

  const fetchAISummary = async () => {
    try {
      const res = await API.get(`/parents/ai-summary/${studentId}`);
      setAiSummary(res.data);
    } catch (err) {
      console.error("Failed to load AI summary", err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      await fetchResults();
      await fetchAISummary();
      setLoading(false);
    };
    loadAll();
  }, [studentId]);

  useVisiblePolling(fetchResults, PARENT_RESULTS_REFRESH_MS, {
    enabled: !loading,
    runOnMount: false,
  });
  useVisiblePolling(fetchAISummary, PARENT_AI_SUMMARY_REFRESH_MS, {
    enabled: !loading,
    runOnMount: false,
  });

  if (loading) return <p className="text-sm text-gray-500">Loading performance data...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div>
      <Link to="/parent" className="text-sm text-blue-600 underline">
        Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold mb-6 mt-2">{student?.name}'s Performance</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Test Results</h2>

        {results.length === 0 ? (
          <p className="text-sm text-gray-500">No test attempts yet.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Test</th>
                <th>Score</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2">{r.testTitle}</td>
                  <td>
                    {r.score} / {r.totalMarks}
                  </td>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">AI Performance Summary</h2>

        {!aiSummary ? (
          <p className="text-sm text-gray-500">AI analysis not available.</p>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm">
                <strong>Attempts:</strong> {aiSummary.metrics?.attempts ?? 0}
              </p>
              <p className="text-sm">
                <strong>Average Score:</strong> {aiSummary.metrics?.averageScore ?? 0}%
              </p>
              <p className="text-sm">
                <strong>Trend:</strong> {aiSummary.metrics?.trend || "-"}
              </p>
            </div>

            <div className="mb-4">
              <strong>Strengths</strong>
              <ul className="list-disc ml-6 text-sm mt-1">
                {aiStrengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
                {aiStrengths.length === 0 && <li>No strengths data</li>}
              </ul>
            </div>

            <div className="mb-4">
              <strong>Weaknesses</strong>
              <ul className="list-disc ml-6 text-sm mt-1">
                {aiWeaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {aiWeaknesses.length === 0 && <li>No weaknesses data</li>}
              </ul>
            </div>

            <div>
              <strong>Recommendations</strong>
              <ul className="list-disc ml-6 text-sm mt-1">
                {aiRecommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
                {aiRecommendations.length === 0 && <li>No recommendations data</li>}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

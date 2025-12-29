import { useEffect, useState } from "react";
import API from "../../services/api";
import { getUser } from "../../utils/auth";

export default function Results() {
  const [results, setResults] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorAI, setErrorAI] = useState("");

  /* ---------------- LOAD RESULTS ---------------- */
  useEffect(() => {
    API.get("/submissions/my")
      .then((res) => setResults(res.data))
      .catch((err) =>
        console.error("Error fetching results:", err)
      );
  }, []);

  /* ---------------- AI WEAK TOPIC SUMMARY ---------------- */
  const analyzeWeakTopics = async () => {
    try {
      setLoadingAI(true);
      setErrorAI("");
      setAiSummary(null);

      const user = getUser();

      const res = await API.post("/ai/weak-topic-summary", {
        studentId: user.id,
      });

      setAiSummary(res.data.summary || res.data);
    } catch (err) {
      console.error(err);
      setErrorAI("AI analysis failed. Please try again later.");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">My Results</h1>

      {/* ================= AI ANALYSIS ================= */}
      <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-lg p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">
            AI Weak Topic Analysis
          </h2>

          <button
            onClick={analyzeWeakTopics}
            disabled={loadingAI || results.length === 0}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {loadingAI
              ? "Analyzing..."
              : "Analyze Weak Topics with AI"}
          </button>
        </div>

        {results.length === 0 && (
          <p className="text-sm text-gray-500">
            Attempt tests to unlock AI insights.
          </p>
        )}

        {errorAI && (
          <p className="text-sm text-red-600">{errorAI}</p>
        )}

        {!loadingAI && aiSummary && (
          <pre className="mt-3 bg-white border rounded p-4 text-sm whitespace-pre-wrap text-gray-800">
            {typeof aiSummary === "string"
              ? aiSummary
              : JSON.stringify(aiSummary, null, 2)}
          </pre>
        )}
      </div>

      {/* ================= RESULTS TABLE ================= */}
      <table className="w-full bg-white border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Test</th>
            <th>Duration</th>
            <th>Score</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          {results.length === 0 && (
            <tr>
              <td
                colSpan="4"
                className="p-4 text-center text-gray-500"
              >
                No results found
              </td>
            </tr>
          )}

          {results.map((r) => (
            <tr key={r._id} className="border-t">
              <td className="p-2">{r.test.title}</td>
              <td>{r.test.durationMinutes} mins</td>
              <td className="font-semibold">{r.score}</td>
              <td>
                {new Date(
                  r.submittedAt
                ).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

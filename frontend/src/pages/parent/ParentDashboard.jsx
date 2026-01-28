import { useEffect, useState } from "react";
import API from "../../services/api";
import ParentSummary from "./ParentSummary";
import ParentResultsTable from "./ParentResultsTable";

export default function ParentDashboard() {
  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ===== AI STATES ===== */
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorAI, setErrorAI] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const res = await API.get("/parents/dashboard");
        setStudent(res.data.student);
        setResults(res.data.results || []);
        setError("");
      } catch (err) {
        const message = err.response?.data?.message;
        setError(message || "");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const analyzeStudentWithAI = async () => {
    try {
      setLoadingAI(true);
      setErrorAI("");
      setAiSummary(null);

      const res = await API.post("/ai/weak-topic-summary", {
        studentId: student.id,
      });

      setAiSummary(res.data.summary || res.data);
    } catch {
      setErrorAI("AI analysis failed. Please try again later.");
    } finally {
      setLoadingAI(false);
    }
  };

  if (loading) {
    return <p className="text-center mt-10">Loading dashboard...</p>;
  }

  if (error) {
    return (
      <p className="text-center text-red-600 mt-10">{error}</p>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* ================= STUDENT PROFILE ================= */}
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Student Profile
        </h2>

        {student && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <p>
              <strong>Name:</strong> {student.name}
            </p>
            <p>
              <strong>Email:</strong> {student.email}
            </p>
            <p>
              <strong>Role:</strong> Student
            </p>
          </div>
        )}
      </div>

      {/* ================= SUMMARY ================= */}
      {results.length > 0 && (
        <ParentSummary results={results} />
      )}

      {/* ================= RESULTS TABLE ================= */}
      {results.length > 0 && (
        <ParentResultsTable results={results} />
      )}

      {/* ================= AI INSIGHTS ================= */}
      <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-lg p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">
            AI Learning Insights
          </h2>

          <button
            onClick={analyzeStudentWithAI}
            disabled={loadingAI || results.length === 0}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {loadingAI ? "Analyzing..." : "Analyze with AI"}
          </button>
        </div>

        {errorAI && (
          <p className="text-sm text-red-600">{errorAI}</p>
        )}

        {!loadingAI && aiSummary && (
          <pre className="mt-3 bg-white border rounded p-4 text-sm whitespace-pre-wrap">
            {typeof aiSummary === "string"
              ? aiSummary
              : JSON.stringify(aiSummary, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

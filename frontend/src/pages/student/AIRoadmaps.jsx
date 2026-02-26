import { useEffect, useState } from "react";
import API from "../../services/api";

const ROADMAP_MONTH_OPTIONS = [1, 2];

export default function AIRoadmaps() {
  const [roadmapLanguage, setRoadmapLanguage] = useState("Java");
  const [roadmapMonths, setRoadmapMonths] = useState(1);
  const [roadmapLevel, setRoadmapLevel] = useState("beginner");
  const [roadmapGoal, setRoadmapGoal] = useState("");
  const [codingRoadmap, setCodingRoadmap] = useState(null);
  const [codingRoadmapHistory, setCodingRoadmapHistory] = useState([]);
  const [codingRoadmapHistoryLoading, setCodingRoadmapHistoryLoading] =
    useState(false);
  const [codingRoadmapLoading, setCodingRoadmapLoading] = useState(false);
  const [roadmapPdfLoading, setRoadmapPdfLoading] = useState(false);
  const [codingRoadmapStatus, setCodingRoadmapStatus] = useState({
    type: "",
    text: "",
  });

  const loadCodingRoadmapHistory = async () => {
    try {
      setCodingRoadmapHistoryLoading(true);
      const res = await API.get("/ai/coding-roadmap/history");
      const history = Array.isArray(res.data?.history) ? res.data.history : [];
      setCodingRoadmapHistory(history);
      setCodingRoadmap((prev) => {
        if (!history.length) return null;
        if (prev && history.some((item) => item._id === prev._id)) return prev;
        return history[0];
      });
    } catch {
      setCodingRoadmapStatus({
        type: "error",
        text: "Could not load coding roadmap history",
      });
    } finally {
      setCodingRoadmapHistoryLoading(false);
    }
  };

  const downloadRoadmapPdf = async (roadmap) => {
    if (!roadmap?._id) return;
    try {
      setRoadmapPdfLoading(true);
      const res = await API.get(`/ai/coding-roadmap/${roadmap._id}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeLanguage = String(roadmap.language || "coding")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const duration = Number(roadmap.durationMonths) || roadmapMonths;
      link.href = url;
      link.download = `${safeLanguage || "coding"}-roadmap-${duration}m.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setCodingRoadmapStatus({
        type: "error",
        text: err.response?.data?.error || "Failed to download roadmap PDF",
      });
    } finally {
      setRoadmapPdfLoading(false);
    }
  };

  const generateCodingRoadmap = async () => {
    const language = String(roadmapLanguage || "").trim();
    if (language.length < 2) {
      setCodingRoadmapStatus({
        type: "error",
        text: "Please enter a valid language (for example: Java, Python, C++).",
      });
      return;
    }

    setCodingRoadmapStatus({ type: "", text: "" });
    try {
      setCodingRoadmapLoading(true);
      const res = await API.post("/ai/coding-roadmap", {
        language,
        durationMonths: Number(roadmapMonths) || 1,
        level: roadmapLevel,
        goal: roadmapGoal,
      });

      const roadmap = res.data?.roadmap || null;
      if (!roadmap) {
        setCodingRoadmapStatus({
          type: "error",
          text: "Roadmap could not be generated right now.",
        });
        return;
      }

      setCodingRoadmap(roadmap);
      setCodingRoadmapHistory((prev) => {
        const filtered = prev.filter((item) => item._id !== roadmap._id);
        return [roadmap, ...filtered].slice(0, 20);
      });
      setCodingRoadmapStatus({
        type: "success",
        text:
          res.data?.source === "fallback" && res.data?.warning
            ? `Roadmap generated (${res.data.warning})`
            : "Coding roadmap generated successfully.",
      });
    } catch (err) {
      setCodingRoadmapStatus({
        type: "error",
        text: err.response?.data?.error || "Failed to generate coding roadmap",
      });
    } finally {
      setCodingRoadmapLoading(false);
    }
  };

  useEffect(() => {
    void loadCodingRoadmapHistory();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Roadmaps</h1>

      <div className="bg-violet-50 border border-violet-200 rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">AI Coding Roadmap</h2>
            <p className="text-sm text-gray-600">
              Generate a roadmap for any language (Java, Python, C++, etc.) with
              1-month or 2-month planning.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateCodingRoadmap}
              disabled={codingRoadmapLoading}
              className="bg-violet-600 text-white px-4 py-2 rounded hover:bg-violet-700 disabled:opacity-60"
            >
              {codingRoadmapLoading ? "Generating..." : "Generate Roadmap"}
            </button>
            <button
              onClick={() => downloadRoadmapPdf(codingRoadmap)}
              disabled={!codingRoadmap?._id || roadmapPdfLoading}
              className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-60"
            >
              {roadmapPdfLoading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            type="text"
            value={roadmapLanguage}
            onChange={(e) => setRoadmapLanguage(e.target.value)}
            placeholder="Language (Java, Python, C++)"
            className="border rounded px-3 py-2"
          />

          <select
            value={roadmapMonths}
            onChange={(e) => setRoadmapMonths(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            {ROADMAP_MONTH_OPTIONS.map((month) => (
              <option key={month} value={month}>
                {month} Month{month > 1 ? "s" : ""}
              </option>
            ))}
          </select>

          <select
            value={roadmapLevel}
            onChange={(e) => setRoadmapLevel(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <textarea
          rows={2}
          value={roadmapGoal}
          onChange={(e) => setRoadmapGoal(e.target.value)}
          placeholder="Optional goal (example: DSA + interview prep)"
          className="w-full border rounded px-3 py-2 mb-3"
        />

        {codingRoadmapStatus.text && (
          <p
            className={`text-sm mb-3 ${
              codingRoadmapStatus.type === "error"
                ? "text-red-600"
                : "text-green-700"
            }`}
          >
            {codingRoadmapStatus.text}
          </p>
        )}

        {codingRoadmap && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              Language: {codingRoadmap.language} | Duration:{" "}
              {codingRoadmap.durationMonths} month(s) | Level:{" "}
              {codingRoadmap.level} | Created:{" "}
              {codingRoadmap.createdAt
                ? new Date(codingRoadmap.createdAt).toLocaleDateString()
                : "-"}
            </p>
            <pre className="text-sm whitespace-pre-wrap text-gray-800 bg-white border rounded p-3">
              {codingRoadmap.planText}
            </pre>
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Roadmap History</h3>
          {codingRoadmapHistoryLoading ? (
            <p className="text-sm text-gray-500">Loading roadmap history...</p>
          ) : codingRoadmapHistory.length === 0 ? (
            <p className="text-sm text-gray-500">
              No roadmap history yet. Generate one to save it.
            </p>
          ) : (
            <div className="space-y-2">
              {codingRoadmapHistory.slice(0, 10).map((item) => (
                <div
                  key={item._id}
                  className="bg-white border rounded px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                >
                  <p className="text-sm">
                    {item.language} | {item.durationMonths} month(s) | {item.level} |{" "}
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString()
                      : "-"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCodingRoadmap(item)}
                      className="text-sm text-violet-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => downloadRoadmapPdf(item)}
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

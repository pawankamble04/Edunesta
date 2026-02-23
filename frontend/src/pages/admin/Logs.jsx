import { useEffect, useMemo, useState } from "react";
import api from "../../utils/axios";

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (actionFilter) params.action = actionFilter;
      if (targetFilter) params.target = targetFilter;
      params.page = page;
      params.limit = 30;

      const res = await api.get("/admin/logs", { params });
      setLogs(res.data?.items || []);
      setPages(res.data?.pages || 1);
    } catch (err) {
      console.error("Failed to load logs", err);
      setError("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, targetFilter, page]);

  const actions = useMemo(
    () => [...new Set(logs.map((l) => l.action).filter(Boolean))],
    [logs]
  );
  const targets = useMemo(
    () => [...new Set(logs.map((l) => l.target).filter(Boolean))],
    [logs]
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => {
            setPage(1);
            setActionFilter(e.target.value);
          }}
          className="border p-2 rounded"
        >
          <option value="">All Actions</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>

        <select
          value={targetFilter}
          onChange={(e) => {
            setPage(1);
            setTargetFilter(e.target.value);
          }}
          className="border p-2 rounded"
        >
          <option value="">All Targets</option>
          {targets.map((target) => (
            <option key={target} value={target}>
              {target}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {loading ? (
        <p>Loading logs...</p>
      ) : (
        <>
          <table className="w-full bg-white border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="text-left">Action</th>
                <th className="text-left">Actor</th>
                <th className="text-left">Target</th>
                <th className="text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-gray-500">
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="border-t">
                    <td className="p-2">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>{log.action}</td>
                    <td>{log.actor?.email || log.actor?.role || "-"}</td>
                    <td>{log.target || "-"}</td>
                    <td className="max-w-xl truncate">
                      {JSON.stringify(log.meta || {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex gap-2 mt-4">
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 border rounded ${
                    page === i + 1 ? "bg-blue-600 text-white" : "bg-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

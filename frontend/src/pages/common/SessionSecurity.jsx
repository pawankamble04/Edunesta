import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import { clearAuth } from "../../utils/storage";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function SessionSecurity() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [busyId, setBusyId] = useState("");
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  const currentSession = useMemo(
    () => sessions.find((item) => item.isCurrent) || null,
    [sessions]
  );

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await API.get("/auth/sessions");
      const rows = Array.isArray(res.data?.sessions) ? res.data.sessions : [];
      setSessions(rows);
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to load sessions.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const revokeSession = async (id) => {
    if (!id) return;
    setStatus({ type: "", text: "" });
    setBusyId(id);
    try {
      const res = await API.delete(`/auth/sessions/${id}`);
      if (res.data?.isCurrent) {
        clearAuth();
        navigate("/login");
        return;
      }
      setStatus({ type: "success", text: res.data?.message || "Session revoked." });
      await loadSessions();
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to revoke session.",
      });
    } finally {
      setBusyId("");
    }
  };

  const handleLogoutAll = async () => {
    setStatus({ type: "", text: "" });
    setLogoutAllBusy(true);
    try {
      await API.post("/auth/logout-all");
      clearAuth();
      navigate("/login");
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to logout from all sessions.",
      });
      setLogoutAllBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 pt-24">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Session Security</h1>
          <p className="text-sm text-gray-600">
            Review active devices and revoke suspicious sessions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded border px-3 py-2 text-sm"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleLogoutAll}
            disabled={logoutAllBusy}
            className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {logoutAllBusy ? "Logging out..." : "Logout All Devices"}
          </button>
        </div>
      </div>

      {status.text ? (
        <p
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            status.type === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      {loading ? (
        <p>Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p className="rounded border bg-white p-4 text-sm text-gray-600">
          No active sessions found.
        </p>
      ) : (
        <div className="space-y-3">
          {currentSession ? (
            <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Current session: {currentSession.userAgent || "Unknown device"} | Last
              used: {formatDateTime(currentSession.lastUsedAt)}
            </div>
          ) : null}

          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded border bg-white p-4 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-[240px]">
                <p className="font-semibold text-sm">
                  {session.userAgent || "Unknown device"}{" "}
                  {session.isCurrent ? (
                    <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      Current
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  IP: {session.ipAddress || "-"}
                </p>
                <p className="text-xs text-gray-600">
                  Created: {formatDateTime(session.createdAt)}
                </p>
                <p className="text-xs text-gray-600">
                  Last used: {formatDateTime(session.lastUsedAt)}
                </p>
                <p className="text-xs text-gray-600">
                  Expires: {formatDateTime(session.expiresAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => revokeSession(session.id)}
                disabled={busyId === session.id}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-60"
              >
                {busyId === session.id ? "Revoking..." : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

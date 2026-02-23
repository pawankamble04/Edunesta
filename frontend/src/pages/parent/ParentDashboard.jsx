import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../../services/api";
import useVisiblePolling from "../../utils/useVisiblePolling";
import { getUser } from "../../utils/storage";

const PARENT_DASHBOARD_REFRESH_MS = 15_000;

export default function ParentDashboard() {
  const [linkCode, setLinkCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [children, setChildren] = useState([]);
  const [dailyNotifications, setDailyNotifications] = useState([]);
  const [notificationDate, setNotificationDate] = useState("");
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationInfo, setNotificationInfo] = useState("");

  /* -----------------------------------
     LINK STUDENT USING CODE
  ------------------------------------*/
  const linkStudent = async () => {
    const normalizedCode = String(linkCode || "").replace(/\D/g, "");

    if (!normalizedCode || normalizedCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      await API.post("/parents/link", {
        code: normalizedCode,
      });

      setMessage("Student linked successfully");
      setLinkCode("");
      refreshDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Invalid or expired link code"
      );
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------------
     FETCH LINKED CHILDREN
  ------------------------------------*/
  const fetchChildren = async () => {
    try {
      const res = await API.get("/parents/children");
      setChildren(res.data.children || []);
    } catch (err) {
      console.error("Failed to load children", err);
    }
  };

  const fetchDailyNotifications = async () => {
    try {
      const res = await API.get("/parents/notifications/daily");
      const date = res.data?.date || new Date().toISOString().slice(0, 10);
      const notifications = Array.isArray(res.data?.notifications)
        ? res.data.notifications
        : [];

      setNotificationDate(date);
      setDailyNotifications(notifications);

      const user = getUser();
      const parentId = user?.id || user?._id || "parent";
      const storageKey = `parent_daily_notification_seen_${parentId}_${date}`;
      const seen = window.localStorage.getItem(storageKey) === "1";

      if (!seen && notifications.length > 0) {
        setNotificationVisible(true);
        setNotificationInfo("");
        window.localStorage.setItem(storageKey, "1");
      } else if (notifications.length > 0) {
        setNotificationVisible(false);
        setNotificationInfo("Today's summary already viewed.");
      } else {
        setNotificationVisible(false);
        setNotificationInfo("No daily summary available yet.");
      }
    } catch (err) {
      console.error("Failed to load daily notifications", err);
      setNotificationVisible(false);
      setNotificationInfo("Failed to load daily notifications.");
    }
  };

  const refreshDashboard = async () => {
    await Promise.all([fetchChildren(), fetchDailyNotifications()]);
  };

  useVisiblePolling(refreshDashboard, PARENT_DASHBOARD_REFRESH_MS);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Parent Dashboard
      </h1>

      {/* ================= NOTIFICATIONS ================= */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          {notificationDate && (
            <span className="text-xs text-gray-500">Date: {notificationDate}</span>
          )}
        </div>

        {notificationVisible ? (
          <div className="space-y-3">
            {dailyNotifications.map((item) => (
              <div key={item.studentId} className="rounded border bg-blue-50 p-4">
                <p className="font-semibold mb-2">
                  Daily Student Summary - {item.studentName}
                </p>
                <p className="text-sm">Attendance: {item.attendance}</p>
                <p className="text-sm">
                  Test Marks:{" "}
                  {typeof item.testMarks === "number" ? item.testMarks : "No test today"}
                </p>
                <p className="text-sm">Average: {item.average ?? 0}%</p>
              </div>
            ))}

            <button
              onClick={() => setNotificationVisible(false)}
              className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-600">{notificationInfo || "No new notification."}</p>
        )}
      </div>

      {/* ================= LINK STUDENT ================= */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-2">
          Link Your Child
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          Ask your child for the 6-digit link code generated
          from their Student Dashboard.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={linkCode}
            onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, ""))}
            maxLength={6}
            placeholder="Enter 6-digit code"
            className="border rounded px-3 py-2 w-48 text-center tracking-widest"
          />

          <button
            onClick={linkStudent}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {loading ? "Linking..." : "Link Student"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 mt-3">
            {error}
          </p>
        )}

        {message && (
          <p className="text-sm text-green-600 mt-3">
            {message}
          </p>
        )}
      </div>

      {/* ================= LINKED CHILDREN ================= */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">
          Linked Children
        </h2>

        {children.length === 0 ? (
          <p className="text-sm text-gray-500">
            No children linked yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children.map((child) => (
              <div
                key={child._id}
                className="border rounded p-4"
              >
                <p className="font-medium">
                  {child.name}
                </p>
                <p className="text-sm text-gray-600">
                  {child.email}
                </p>

                <Link
                  to={`/parent/results/${child._id}`}
                  className="inline-block mt-3 text-blue-600 underline text-sm"
                >
                  View Results
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useState } from "react";
import API from "../../services/api";
import useVisiblePolling from "../../utils/useVisiblePolling";
import RoleStudyBuddyChat from "../../components/ai/RoleStudyBuddyChat";

const TEACHER_DASHBOARD_REFRESH_MS = 15_000;

export default function TeacherDashboard() {
  const [stats, setStats] = useState({
    testsCreated: 0,
    activeTests: 0,
    studentsAttempted: 0,
    averageScore: "0%",
  });

  const [joinCode, setJoinCode] = useState(null);

  // 🔥 NEW STATE
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [studentEmail, setStudentEmail] = useState("");
  const [connectSubject, setConnectSubject] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [myStudents, setMyStudents] = useState([]);
  const [status, setStatus] = useState({
    type: "",
    text: "",
  });

  const loadDashboard = async () => {
    try {
      const res = await API.get("/teacher/dashboard");
      const data = res.data || {};

      const loadedSubjects = data.subjects || [];
      setJoinCode(data.teacherJoinCode || null);
      setSubjects(loadedSubjects);
      setMyStudents(data.students || []);
      setStats(
        data.stats || {
          testsCreated: 0,
          activeTests: 0,
          studentsAttempted: 0,
          averageScore: "0%",
        }
      );

      setConnectSubject((prev) => {
        if (!loadedSubjects.length) return "";
        if (prev && loadedSubjects.includes(prev)) return prev;
        return loadedSubjects[0];
      });
    } catch (err) {
      console.error("Teacher dashboard error", err);
    }
  };

  useVisiblePolling(loadDashboard, TEACHER_DASHBOARD_REFRESH_MS);

  const copyCode = () => {
    setStatus({ type: "", text: "" });
    if (joinCode) {
      navigator.clipboard
        .writeText(joinCode)
        .then(() =>
          setStatus({ type: "success", text: "Join code copied." })
        )
        .catch(() =>
          setStatus({ type: "error", text: "Could not copy join code." })
        );
    }
  };

  // 🔥 ADD SUBJECT
  const handleAddSubject = async () => {
    if (!newSubject.trim()) return;
    setStatus({ type: "", text: "" });

    try {
      setLoadingSubjects(true);
      const res = await API.post("/teacher/subjects", {
        subject: newSubject,
      });

      const updatedSubjects = res.data.subjects || [];
      setSubjects(updatedSubjects);
      if (!connectSubject && updatedSubjects.length > 0) {
        setConnectSubject(updatedSubjects[0]);
      }
      setNewSubject("");
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to add subject",
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  // 🔥 DELETE SUBJECT
  const handleDeleteSubject = async (subject) => {
    setStatus({ type: "", text: "" });
    try {
      setLoadingSubjects(true);
      const res = await API.delete(
        `/teacher/subjects/${subject}`
      );
      const updatedSubjects = res.data.subjects || [];
      setSubjects(updatedSubjects);
      if (!updatedSubjects.includes(connectSubject)) {
        setConnectSubject(updatedSubjects[0] || "");
      }
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to remove subject",
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleConnectStudent = async () => {
    setStatus({ type: "", text: "" });
    if (!studentEmail.trim() || !connectSubject) {
      setStatus({
        type: "error",
        text: "Student email and subject are required",
      });
      return;
    }

    try {
      setConnectLoading(true);
      await API.post("/enrollments/connect-student", {
        studentEmail: studentEmail.trim(),
        subject: connectSubject,
      });

      setStudentEmail("");
      await loadDashboard();
      setStatus({ type: "success", text: "Student connected successfully." });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to connect student",
      });
    } finally {
      setConnectLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Teacher Dashboard
      </h1>
      {status.text && (
        <p
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            status.type === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {status.text}
        </p>
      )}

      {/* 🔐 JOIN CODE CARD */}
      {joinCode && (
        <div className="bg-indigo-50 border border-indigo-200 p-5 rounded mb-6 flex justify-between items-center">
          <div>
            <p className="text-sm text-indigo-600">
              Your Join Code
            </p>
            <p className="text-xl font-bold text-indigo-800 mt-1">
              {joinCode}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Share this code with students
            </p>
          </div>

          <button
            onClick={copyCode}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Copy
          </button>
        </div>
      )}

      {/* 🔥 SUBJECT MANAGEMENT */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">
          My Subjects
        </h2>

        <div className="flex flex-wrap gap-3 mb-4">
          {subjects.length === 0 && (
            <p className="text-sm text-gray-500">
              No subjects added yet.
            </p>
          )}

          {subjects.map((sub) => (
            <div
              key={sub}
              className="flex items-center bg-gray-100 px-3 py-1 rounded"
            >
              <span className="mr-2 capitalize">{sub}</span>
              <button
                onClick={() => handleDeleteSubject(sub)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add new subject"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="border px-3 py-2 rounded w-full"
          />
          <button
            onClick={handleAddSubject}
            disabled={loadingSubjects}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>

      {/* CONNECT SPECIFIC STUDENT */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Connect Specific Student
        </h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-gray-500">
            Add at least one subject before connecting students.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="email"
                placeholder="Student email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="border px-3 py-2 rounded"
              />
              <select
                value={connectSubject}
                onChange={(e) => setConnectSubject(e.target.value)}
                className="border px-3 py-2 rounded"
              >
                {subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
              <button
                onClick={handleConnectStudent}
                disabled={connectLoading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {connectLoading ? "Connecting..." : "Connect Student"}
              </button>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Connected Students</p>
              {myStudents.length === 0 ? (
                <p className="text-sm text-gray-500">No students connected yet.</p>
              ) : (
                <div className="space-y-2">
                  {myStudents.map((student) => (
                    <div
                      key={`${student.id}-${student.subject}`}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      {student.name} ({student.email}) - {student.subject}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mb-8">
        <RoleStudyBuddyChat role="teacher" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Stat title="Tests Created" value={stats.testsCreated} />
        <Stat title="Active Tests" value={stats.activeTests} />
        <Stat
          title="Students Attempted"
          value={stats.studentsAttempted}
        />
        <Stat title="Average Score" value={stats.averageScore} />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Action
          title="Create Test"
          desc="Create a new test"
          link="/teacher/create-test"
          color="blue"
        />
        <Action
          title="Manage Tests"
          desc="Edit or disable tests"
          link="/teacher/tests"
          color="purple"
        />
        <Action
          title="Submissions"
          desc="View student submissions"
          link="/teacher/tests"
          color="green"
        />
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="bg-white p-6 rounded shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function Action({ title, desc, link, color }) {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700",
    purple: "bg-purple-600 hover:bg-purple-700",
    green: "bg-green-600 hover:bg-green-700",
  };

  return (
    <div className="bg-white p-6 rounded shadow flex flex-col justify-between">
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{desc}</p>
      </div>

      <Link
        to={link}
        className={`mt-4 text-white px-4 py-2 rounded w-fit ${colors[color]}`}
      >
        Open
      </Link>
    </div>
  );
}

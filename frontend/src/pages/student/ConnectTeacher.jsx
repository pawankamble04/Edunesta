import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

export default function ConnectTeacher() {
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  /* ===============================
     STEP 1 — FETCH SUBJECTS
  =============================== */
  const fetchSubjects = async () => {
    if (!joinCode.trim()) {
      setError("Please enter a join code");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await API.get(
        `/teacher/subjects-by-code/${joinCode.trim()}`
      );

      if (!res.data.subjects || res.data.subjects.length === 0) {
        setError("No subjects found for this teacher");
        return;
      }

      setTeacherName(res.data.teacherName);
      setSubjects(res.data.subjects);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid join code");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     STEP 2 — CONNECT
  =============================== */
  const connect = async () => {
    if (!selectedSubject) {
      setError("Please select a subject");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await API.post("/enrollments/connect", {
        joinCode: joinCode.trim(),
        subject: selectedSubject,
      });

      // Professional redirect
      navigate("/student");
    } catch (err) {
      setError(err.response?.data?.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white shadow p-8 rounded-lg border mt-10">
      <h2 className="text-2xl font-bold mb-6">
        Connect to Teacher
      </h2>

      {error && (
        <div className="bg-red-100 text-red-600 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <>
          <input
            type="text"
            placeholder="Enter Teacher Join Code"
            value={joinCode}
            onChange={(e) =>
              setJoinCode(e.target.value.toUpperCase())
            }
            className="w-full border px-4 py-2 rounded mb-4"
          />

          <button
            onClick={fetchSubjects}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
          >
            {loading ? "Checking..." : "Next"}
          </button>
        </>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <>
          <p className="mb-3 text-gray-600">
            Teacher: <strong>{teacherName}</strong>
          </p>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full border px-4 py-2 rounded mb-4"
          >
            <option value="">Select Subject</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            onClick={connect}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </>
      )}
    </div>
  );
}

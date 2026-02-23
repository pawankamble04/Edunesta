import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

export default function CreateTest() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await API.get("/teacher/subjects");
        setSubjects(res.data.subjects || []);
      } catch (err) {
        console.error("Failed to load subjects", err);
      } finally {
        setLoadingSubjects(false);
      }
    };

    loadSubjects();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!subject) {
      setError("Please select a subject");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await API.post("/tests", {
        title,
        description,
        subject: subject.toLowerCase(),
        durationMinutes: Number(duration),
        totalMarks: Number(totalMarks),
      });

      navigate("/teacher/tests");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to create test");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-6">Create Test</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loadingSubjects ? (
        <p>Loading subjects...</p>
      ) : subjects.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <p className="text-yellow-700">
            You must add subjects first before creating a test.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white border rounded p-6 space-y-4"
        >
          <input
            type="text"
            placeholder="Test Title"
            className="w-full border p-2 rounded"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">Select Subject</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub.charAt(0).toUpperCase() + sub.slice(1)}
              </option>
            ))}
          </select>

          <textarea
            placeholder="Description"
            className="w-full border p-2 rounded"
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <input
            type="number"
            placeholder="Duration (minutes)"
            className="w-full border p-2 rounded"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Total Marks"
            className="w-full border p-2 rounded"
            value={totalMarks}
            onChange={(e) => setTotalMarks(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Test"}
          </button>
        </form>
      )}
    </div>
  );
}

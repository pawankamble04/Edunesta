import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

export default function CreateTest() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await API.post("/tests", {
        title,
        description,
        durationMinutes: Number(duration),
        totalMarks: Number(totalMarks),
      });

      alert("Test created successfully");
      navigate("/teacher/tests"); // go to test list
    } catch (err) {
      console.error(err);
      alert("Failed to create test");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-6">Create Test</h1>

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
    </div>
  );
}

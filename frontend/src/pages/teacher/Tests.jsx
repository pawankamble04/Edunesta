import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../../services/api";

export default function Tests() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await API.get("/tests");
        setTests(res.data);
      } catch (err) {
        console.error("Error fetching tests", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, []);
// ✅ STEP 3A: publish / unpublish test
const togglePublish = async (id) => {
  try {
    const res = await API.put(`/tests/${id}/publish`);

    setTests((prev) =>
      prev.map((t) =>
        t._id === id
          ? { ...t, isPublished: res.data.isPublished }
          : t
      )
    );
  } catch {
    alert("Failed to update publish status");
  }
};
const deleteTest = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this test?\nAll questions and submissions will be deleted."
    );

    if (!confirmDelete) return;

    try {
      await API.delete(`/tests/${id}`);

      // remove test from UI
      setTests((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      console.error("Delete test failed", err);
      alert("Failed to delete test");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">My Tests</h1>
        <Link
          to="/teacher/create-test"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          Create Test
        </Link>
      </div>

      {loading && <p>Loading tests...</p>}

      {!loading && tests.length === 0 && (
        <p className="text-gray-500">No tests created yet.</p>
      )}

      {!loading && tests.length > 0 && (
        <table className="w-full bg-white border">
          <thead className="bg-gray-100 text-sm">
            <tr>
              <th className="p-2">Title</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {tests.map((test) => (
              <tr key={test._id} className="border-t">
                <td className="p-2">{test.title}</td>
                <td>{test.durationMinutes} mins</td>
                <td
                  className={
                    test.isPublished
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {test.isPublished ? "Published" : "Draft"}
                </td>

                <td className="flex gap-4 p-2">
                  {/* Questions */}
                  <Link
                    className="text-blue-600"
                    to={`/teacher/questions?testId=${test._id}`}
                  >
                    Questions
                  </Link>
                  <button
  onClick={() => togglePublish(test._id)}
  
  className={`text-sm ${
    test.isPublished ? "text-red-600" : "text-green-600"
  }`}
>
  {test.isPublished ? "Unpublish" : "Publish"}
</button>


                  {/* ✅ View Submissions (IMPORTANT) */}
                  <button
                    onClick={() =>
                      navigate(`/teacher/submissions/${test._id}`)
                    }
                    className="text-indigo-600 hover:underline"
                  >
                    Submissions
                  </button>

                  {/* DELETE TEST */}
                  <button
                    onClick={() => deleteTest(test._id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

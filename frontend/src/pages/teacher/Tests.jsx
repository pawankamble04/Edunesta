import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import API from "../../services/api";

export default function Tests() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [actionError, setActionError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const testsPerPage = 5;

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

  const subjectStats = useMemo(() => {
    const stats = {};
    tests.forEach((t) => {
      stats[t.subject] = (stats[t.subject] || 0) + 1;
    });
    return stats;
  }, [tests]);

  const processedTests = useMemo(() => {
    let filtered = [...tests];

    if (selectedSubject !== "All") {
      filtered = filtered.filter((t) => t.subject === selectedSubject);
    }

    if (searchTerm.trim() !== "") {
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return filtered;
  }, [tests, selectedSubject, searchTerm, sortOrder]);

  const totalPages = Math.ceil(processedTests.length / testsPerPage);

  const paginatedTests = processedTests.slice(
    (currentPage - 1) * testsPerPage,
    currentPage * testsPerPage
  );

  const togglePublish = async (id) => {
    setActionError("");
    try {
      const res = await API.put(`/tests/${id}/publish`);

      setTests((prev) =>
        prev.map((t) =>
          t._id === id ? { ...t, isPublished: res.data.isPublished } : t
        )
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Failed to update publish status"
      );
    }
  };

  const deleteTest = async (id) => {
    if (!window.confirm("Delete this test and all submissions?")) return;
    setActionError("");

    try {
      await API.delete(`/tests/${id}`);
      setTests((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to delete test");
    }
  };

  const subjects = ["All", ...new Set(tests.map((t) => t.subject))];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">My Tests</h1>
        <div className="flex gap-2">
          <Link
            to="/teacher/ai-test"
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm"
          >
            AI Test
          </Link>
          <Link
            to="/teacher/create-test"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Create Test
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(subjectStats).map(([subject, count]) => (
          <div key={subject} className="bg-white border p-4 rounded shadow-sm">
            <p className="text-sm text-gray-500">{subject}</p>
            <p className="text-xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      {actionError && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="border p-2 rounded"
        >
          {subjects.map((subj) => (
            <option key={subj} value={subj}>
              {subj}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search test title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2 rounded"
        />

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {loading && <p>Loading tests...</p>}

      {!loading && paginatedTests.length === 0 && <p>No tests found.</p>}

      {!loading && paginatedTests.length > 0 && (
        <table className="w-full bg-white border">
          <thead className="bg-gray-100 text-sm">
            <tr>
              <th className="p-2 text-left">Title</th>
              <th>Subject</th>
              <th>Duration</th>
              <th>Status</th>
              <th>AI Readiness</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {paginatedTests.map((test) => (
              <tr key={test._id} className="border-t">
                <td className="p-2 font-medium">{test.title}</td>
                <td>{test.subject}</td>
                <td>{test.durationMinutes} mins</td>
                <td
                  className={
                    test.isPublished ? "text-green-600" : "text-yellow-600"
                  }
                >
                  {test.isPublished ? "Published" : "Draft"}
                </td>
                <td>
                  {test.aiReadiness?.aiReady ? (
                    <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                      Ready to Publish
                    </span>
                  ) : (
                    <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
                      AI Review Pending
                    </span>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {test.aiReadiness?.passedQuestions ?? 0}/
                    {test.aiReadiness?.totalQuestions ?? 0} passed
                  </div>
                </td>
                <td className="flex gap-4 p-2">
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

                  <button
                    onClick={() =>
                      navigate(`/teacher/submissions/${test._id}`)
                    }
                    className="text-indigo-600"
                  >
                    Submissions
                  </button>

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

      <div className="flex gap-2 mt-4">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-3 py-1 border rounded ${
              currentPage === i + 1 ? "bg-blue-600 text-white" : ""
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

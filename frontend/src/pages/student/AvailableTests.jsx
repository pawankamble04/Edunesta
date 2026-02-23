import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import API from "../../services/api";

const normalizeSubject = (value) => {
  const subject = String(value || "").trim().toLowerCase();
  if (["math", "maths", "mathematics"].includes(subject)) return "math";
  return subject;
};

export default function AvailableTests() {
  const [tests, setTests] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const [params] = useSearchParams();

  const itemsPerPage = 5;

  useEffect(() => {
    const querySubject = params.get("subject");
    if (querySubject) {
      setSubjectFilter(normalizeSubject(querySubject));
    }
  }, [params]);

  useEffect(() => {
    API.get("/tests")
      .then((res) => {
        setTests(res.data || []);
      })
      .catch((err) => {
        console.error("Error fetching tests:", err);
      });
  }, []);

  const subjects = useMemo(
    () =>
      [...new Set((tests || []).map((t) => normalizeSubject(t.subject)))].filter(
        Boolean
      ),
    [tests]
  );

  const filtered = useMemo(() => {
    let data = [...tests];

    if (subjectFilter) {
      data = data.filter(
        (t) => normalizeSubject(t.subject) === normalizeSubject(subjectFilter)
      );
    }

    if (search) {
      data = data.filter((t) =>
        (t.title || "").toLowerCase().includes(search.toLowerCase())
      );
    }

    data.sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return data;
  }, [tests, subjectFilter, search, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [subjectFilter, search, sortOrder]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Available Tests</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">All Subjects</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject.charAt(0).toUpperCase() + subject.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search by test name"
          className="border p-2 rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      <table className="w-full bg-white border">
        <thead className="bg-gray-100 text-sm">
          <tr>
            <th className="p-2 text-left">Test</th>
            <th>Subject</th>
            <th>Duration</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody className="text-sm">
          {paginatedData.length === 0 && (
            <tr>
              <td colSpan="4" className="p-4 text-center text-gray-500">
                No tests available
              </td>
            </tr>
          )}

          {paginatedData.map((test) => (
            <tr key={test._id} className="border-t">
              <td className="p-2">{test.title}</td>
              <td>
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded">
                  {test.subject}
                </span>
              </td>
              <td>{test.durationMinutes} mins</td>
              <td>
                <Link
                  to={`/student/attempt/${test._id}`}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Start
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
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
    </div>
  );
}

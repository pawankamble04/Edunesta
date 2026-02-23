import { useEffect, useMemo, useState } from "react";
import API from "../../services/api";

export default function StudentLectures() {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState("");

  useEffect(() => {
    const fetchLectures = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get("/lectures/student");
        setLectures(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch lectures");
      } finally {
        setLoading(false);
      }
    };

    fetchLectures();
  }, []);

  const subjects = useMemo(() => {
    const values = [...new Set(lectures.map((lecture) => lecture.subject).filter(Boolean))];
    return values.sort((a, b) => a.localeCompare(b));
  }, [lectures]);

  const filteredLectures = useMemo(() => {
    if (!subjectFilter) return lectures;
    return lectures.filter((lecture) => lecture.subject === subjectFilter);
  }, [lectures, subjectFilter]);

  const openLecture = async (lecture) => {
    setError("");
    setOpeningId(lecture._id);

    let popup = null;

    try {
      popup = window.open("about:blank", "_blank", "noopener,noreferrer");
      await API.post(`/lectures/${lecture._id}/view`);

      const targetUrl = lecture.youtubeWatchUrl || lecture.youtubeUrl;
      if (popup && !popup.closed) {
        popup.location.href = targetUrl;
      } else {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      if (popup && !popup.closed) {
        popup.close();
      }
      setError(err.response?.data?.message || "Failed to open lecture");
    } finally {
      setOpeningId("");
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border rounded p-6">
        <h1 className="text-2xl font-bold mb-2">Lectures</h1>
        <p className="text-sm text-gray-600">
          Watch lectures shared by your connected teachers.
        </p>
      </section>

      <section className="bg-white border rounded p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Lecture List</h2>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Subjects</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p>Loading lectures...</p>
        ) : filteredLectures.length === 0 ? (
          <p className="text-gray-500">
            No lectures available yet for the selected subject.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredLectures.map((lecture) => (
              <article key={lecture._id} className="border rounded p-4">
                <h3 className="font-semibold text-lg">{lecture.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Subject: {lecture.subject}
                  {lecture.batch ? ` | Batch: ${lecture.batch}` : ""}
                </p>
                <p className="text-sm text-gray-600">
                  Teacher: {lecture.createdBy?.name || "Teacher"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Shared on: {new Date(lecture.createdAt).toLocaleDateString()}
                </p>

                <button
                  type="button"
                  onClick={() => openLecture(lecture)}
                  disabled={openingId === lecture._id}
                  className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                >
                  {openingId === lecture._id ? "Opening..." : "Open Video"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

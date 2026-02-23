import { useEffect, useMemo, useState } from "react";
import API from "../../services/api";

const defaultCreateForm = {
  title: "",
  youtubeUrl: "",
  subject: "",
  batch: "",
  isPublished: true,
};

const defaultEditForm = {
  title: "",
  youtubeUrl: "",
  subject: "",
  batch: "",
};

export default function TeacherLectures() {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({
    type: "",
    text: "",
  });

  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [attendanceLectureId, setAttendanceLectureId] = useState("");
  const [attendanceLoadingId, setAttendanceLoadingId] = useState("");
  const [attendanceByLectureId, setAttendanceByLectureId] = useState({});

  const fetchLectures = async () => {
    try {
      setLoading(true);
      const res = await API.get("/lectures/teacher");
      setLectures(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to fetch lectures",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures();
  }, []);

  const handleCreateLecture = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });

    if (!createForm.title.trim() || !createForm.subject.trim() || !createForm.youtubeUrl.trim()) {
      setStatus({
        type: "error",
        text: "Title, subject, and YouTube link are required.",
      });
      return;
    }

    try {
      setSaving(true);
      await API.post("/lectures", {
        title: createForm.title.trim(),
        youtubeUrl: createForm.youtubeUrl.trim(),
        subject: createForm.subject.trim(),
        batch: createForm.batch.trim(),
        isPublished: createForm.isPublished,
      });

      setCreateForm(defaultCreateForm);
      await fetchLectures();
      setStatus({
        type: "success",
        text: "Lecture added successfully.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to add lecture",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (lecture) => {
    setStatus({ type: "", text: "" });
    setEditingId(lecture._id);
    setEditForm({
      title: lecture.title || "",
      youtubeUrl: lecture.youtubeUrl || "",
      subject: lecture.subject || "",
      batch: lecture.batch || "",
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditForm(defaultEditForm);
  };

  const handleUpdateLecture = async (lectureId) => {
    setStatus({ type: "", text: "" });

    if (!editForm.title.trim() || !editForm.subject.trim() || !editForm.youtubeUrl.trim()) {
      setStatus({
        type: "error",
        text: "Title, subject, and YouTube link are required.",
      });
      return;
    }

    try {
      setSaving(true);
      await API.put(`/lectures/${lectureId}`, {
        title: editForm.title.trim(),
        youtubeUrl: editForm.youtubeUrl.trim(),
        subject: editForm.subject.trim(),
        batch: editForm.batch.trim(),
      });

      cancelEdit();
      await fetchLectures();
      setStatus({
        type: "success",
        text: "Lecture updated successfully.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to update lecture",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (lecture) => {
    setStatus({ type: "", text: "" });
    try {
      await API.patch(`/lectures/${lecture._id}/publish`, {
        isPublished: !lecture.isPublished,
      });
      await fetchLectures();
      setStatus({
        type: "success",
        text: lecture.isPublished
          ? "Lecture unpublished."
          : "Lecture published.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to update publish state",
      });
    }
  };

  const handleDelete = async (lectureId) => {
    setStatus({ type: "", text: "" });
    if (!window.confirm("Delete this lecture?")) return;

    try {
      await API.delete(`/lectures/${lectureId}`);
      if (editingId === lectureId) {
        cancelEdit();
      }
      await fetchLectures();
      setStatus({
        type: "success",
        text: "Lecture deleted.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to delete lecture",
      });
    }
  };

  const toggleAttendance = async (lectureId) => {
    if (attendanceLectureId === lectureId) {
      setAttendanceLectureId("");
      return;
    }

    setStatus({ type: "", text: "" });
    setAttendanceLectureId(lectureId);

    try {
      setAttendanceLoadingId(lectureId);
      const res = await API.get(`/lectures/${lectureId}/attendance`);
      setAttendanceByLectureId((prev) => ({
        ...prev,
        [lectureId]: res.data || {
          summary: { total: 0, present: 0, absent: 0 },
          attendance: [],
        },
      }));
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to load attendance",
      });
      setAttendanceLectureId("");
    } finally {
      setAttendanceLoadingId("");
    }
  };

  const sortedLectures = useMemo(
    () =>
      [...lectures].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [lectures]
  );

  return (
    <div className="space-y-8">
      <section className="bg-white border rounded p-6">
        <h1 className="text-2xl font-bold mb-2">Lectures</h1>
        <p className="text-sm text-gray-600 mb-6">
          Add YouTube lectures, manage publish status, and keep students updated.
        </p>

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

        <form
          onSubmit={handleCreateLecture}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <input
            type="text"
            placeholder="Lecture title"
            className="border rounded px-3 py-2"
            value={createForm.title}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, title: e.target.value }))
            }
            required
          />

          <input
            type="text"
            placeholder="Subject (example: math)"
            className="border rounded px-3 py-2"
            value={createForm.subject}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, subject: e.target.value }))
            }
            required
          />

          <input
            type="url"
            placeholder="YouTube link"
            className="border rounded px-3 py-2 md:col-span-2"
            value={createForm.youtubeUrl}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, youtubeUrl: e.target.value }))
            }
            required
          />

          <input
            type="text"
            placeholder="Class / batch (optional)"
            className="border rounded px-3 py-2"
            value={createForm.batch}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, batch: e.target.value }))
            }
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createForm.isPublished}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  isPublished: e.target.checked,
                }))
              }
            />
            Publish now
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Lecture"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold mb-4">My Lectures</h2>

        {loading ? (
          <p>Loading lectures...</p>
        ) : sortedLectures.length === 0 ? (
          <p className="text-gray-500">No lectures added yet.</p>
        ) : (
          <div className="space-y-4">
            {sortedLectures.map((lecture) => (
              <div
                key={lecture._id}
                className="border rounded p-4 flex flex-col gap-3"
              >
                {editingId === lecture._id ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      className="border rounded px-3 py-2"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                    />
                    <input
                      type="text"
                      className="border rounded px-3 py-2"
                      value={editForm.subject}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                    />
                    <input
                      type="url"
                      className="border rounded px-3 py-2 md:col-span-2"
                      value={editForm.youtubeUrl}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          youtubeUrl: e.target.value,
                        }))
                      }
                    />
                    <input
                      type="text"
                      className="border rounded px-3 py-2"
                      value={editForm.batch}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          batch: e.target.value,
                        }))
                      }
                      placeholder="Class / batch"
                    />
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-lg">{lecture.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Subject: {lecture.subject}
                      {lecture.batch ? ` | Batch: ${lecture.batch}` : ""}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Added: {new Date(lecture.createdAt).toLocaleString()}
                    </p>
                    <p
                      className={`inline-block mt-2 rounded px-2 py-1 text-xs ${
                        lecture.isPublished
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {lecture.isPublished ? "Published" : "Unpublished"}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        lecture.youtubeWatchUrl || lecture.youtubeUrl,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="px-3 py-1 rounded border"
                  >
                    Open Video
                  </button>

                  {editingId === lecture._id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateLecture(lecture._id)}
                        disabled={saving}
                        className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-1 rounded border"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(lecture)}
                        className="px-3 py-1 rounded border"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePublish(lecture)}
                        className="px-3 py-1 rounded border"
                      >
                        {lecture.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttendance(lecture._id)}
                        className="px-3 py-1 rounded border"
                      >
                        {attendanceLectureId === lecture._id
                          ? "Hide Attendance"
                          : "Attendance"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(lecture._id)}
                        className="px-3 py-1 rounded bg-red-600 text-white"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {attendanceLectureId === lecture._id && (
                  <div className="rounded border bg-gray-50 p-3">
                    {attendanceLoadingId === lecture._id ? (
                      <p className="text-sm text-gray-600">
                        Loading attendance...
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-medium mb-2">
                          Attendance Summary: Total{" "}
                          {attendanceByLectureId[lecture._id]?.summary?.total || 0}
                          {" | "}Present{" "}
                          {attendanceByLectureId[lecture._id]?.summary?.present || 0}
                          {" | "}Absent{" "}
                          {attendanceByLectureId[lecture._id]?.summary?.absent || 0}
                        </p>

                        {(
                          attendanceByLectureId[lecture._id]?.attendance || []
                        ).length === 0 ? (
                          <p className="text-sm text-gray-500">
                            No connected students for this lecture subject yet.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left border-b">
                                  <th className="py-2 pr-4">Student Name</th>
                                  <th className="py-2 pr-4">Status</th>
                                  <th className="py-2 pr-4">Last Viewed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(attendanceByLectureId[lecture._id]?.attendance || []).map(
                                  (row) => (
                                    <tr key={row.studentId} className="border-b last:border-b-0">
                                      <td className="py-2 pr-4">
                                        {row.name}
                                        {row.email ? (
                                          <span className="text-xs text-gray-500">
                                            {" "}
                                            ({row.email})
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="py-2 pr-4">
                                        <span
                                          className={`rounded px-2 py-1 text-xs ${
                                            row.status === "Present"
                                              ? "bg-green-100 text-green-700"
                                              : "bg-red-100 text-red-700"
                                          }`}
                                        >
                                          {row.status}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4 text-gray-600">
                                        {row.viewedAt
                                          ? new Date(row.viewedAt).toLocaleString()
                                          : "-"}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

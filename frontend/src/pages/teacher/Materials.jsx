import { useEffect, useMemo, useState } from "react";
import API from "../../services/api";

export default function TeacherMaterials() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibleTo, setVisibleTo] = useState("students");
  const [file, setFile] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [openingId, setOpeningId] = useState("");
  const [status, setStatus] = useState({
    type: "",
    text: "",
  });

  const fetchMaterials = async () => {
    try {
      setRefreshing(true);
      const res = await API.get("/materials/teacher");
      setMaterials(res.data || []);
    } catch (err) {
      console.error("Failed to load materials", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });

    if (!title.trim() || !file) {
      setStatus({
        type: "error",
        text: "Title and PDF file are required",
      });
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("visibleTo", visibleTo);
    formData.append("file", file);

    try {
      setLoading(true);
      await API.post("/materials", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setTitle("");
      setDescription("");
      setVisibleTo("students");
      setFile(null);
      await fetchMaterials();
      setStatus({
        type: "success",
        text: "Material uploaded successfully.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Upload failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const sortedMaterials = useMemo(
    () =>
      [...materials].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [materials]
  );

  const openMaterial = async (material) => {
    setStatus({ type: "", text: "" });
    try {
      setOpeningId(material._id);
      const res = await API.get(`/materials/${material._id}/file`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Failed to open file",
      });
    } finally {
      setOpeningId("");
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border rounded p-6">
        <h1 className="text-xl font-bold mb-4">Upload Materials</h1>
        {status.text && (
          <p
            className={`mb-3 rounded border px-3 py-2 text-sm ${
              status.type === "error"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-green-300 bg-green-50 text-green-700"
            }`}
          >
            {status.text}
          </p>
        )}
        <form onSubmit={handleUpload} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Material title"
            className="w-full border p-2 rounded"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border p-2 rounded"
            rows="3"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={visibleTo}
              onChange={(e) => setVisibleTo(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
              <option value="all">All</option>
            </select>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="border p-2 rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? "Uploading..." : "Upload PDF"}
          </button>
        </form>
      </div>

      <div className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold mb-4">My Materials</h2>
        {refreshing ? (
          <p>Loading materials...</p>
        ) : sortedMaterials.length === 0 ? (
          <p className="text-gray-500">No materials uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {sortedMaterials.map((m) => (
              <div
                key={m._id}
                className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-gray-600">{m.description || "-"}</p>
                  <p className="text-xs text-gray-500">
                    Visibility: {m.visibleTo} |{" "}
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => openMaterial(m)}
                  disabled={openingId === m._id}
                  className="text-blue-600 underline disabled:opacity-60"
                >
                  {openingId === m._id ? "Opening..." : "Open PDF"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

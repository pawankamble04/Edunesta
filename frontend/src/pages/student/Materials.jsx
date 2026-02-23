import { useEffect, useMemo, useState } from "react";
import API from "../../services/api";

export default function StudentMaterials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await API.get("/materials/student");
        setMaterials(res.data || []);
      } catch (err) {
        console.error("Failed to load materials", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  const sortedMaterials = useMemo(
    () =>
      [...materials].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [materials]
  );

  const openMaterial = async (material) => {
    setError("");
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
      setError(err.response?.data?.message || "Failed to open file");
    } finally {
      setOpeningId("");
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Study Materials</h1>
      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading materials...</p>
      ) : sortedMaterials.length === 0 ? (
        <p className="text-gray-500">No materials available yet.</p>
      ) : (
        <ul className="bg-white border rounded divide-y">
          {sortedMaterials.map((material) => (
            <li key={material._id} className="p-4 flex justify-between gap-3">
              <div>
                <p className="font-medium">{material.title}</p>
                <p className="text-sm text-gray-600">
                  {material.description || "-"}
                </p>
              </div>
              <button
                onClick={() => openMaterial(material)}
                disabled={openingId === material._id}
                className="text-blue-600 whitespace-nowrap disabled:opacity-60"
              >
                {openingId === material._id ? "Opening..." : "Open"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

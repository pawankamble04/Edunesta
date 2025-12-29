import { useEffect, useState } from "react";
import api from "../../utils/axios";

export default function Moderation() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMaterials = async () => {
    try {
      const res = await api.get("/admin/materials");
      setMaterials(res.data);
    } catch {
      alert("Failed to load materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const toggleStatus = async (id) => {
    await api.patch(`/admin/materials/${id}/status`);
    fetchMaterials();
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm("Delete this material?")) return;
    await api.delete(`/admin/materials/${id}`);
    fetchMaterials();
  };

  if (loading) return <p>Loading materials...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Content Moderation</h1>

      <table className="w-full bg-white border-collapse text-sm">
        <thead className="bg-gray-100 border-b">
          <tr>
            <Th>Title</Th>
            <Th>Uploaded By</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody>
          {materials.map((m) => (
            <tr key={m._id} className="border-b">
              <Td>{m.title}</Td>
              <Td>{m.uploadedBy?.name}</Td>
              <Td>
                {m.isActive ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-red-600">Disabled</span>
                )}
              </Td>
              <Td>
                <button
                  className="text-yellow-600 mr-3"
                  onClick={() => toggleStatus(m._id)}
                >
                  {m.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  className="text-red-600"
                  onClick={() => deleteMaterial(m._id)}
                >
                  Delete
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Th = ({ children }) => (
  <th className="text-left p-3 font-medium">{children}</th>
);
const Td = ({ children }) => <td className="p-3">{children}</td>;

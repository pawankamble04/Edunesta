import { useEffect, useState } from "react";
import api from "../../utils/axios";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");

  // 🔹 Fetch all users
  const fetchUsers = async () => {
    try {
      setError("");
      const res = await api.get("/admin/users", {
        params: { page, limit: 20, search },
      });
      setUsers(res.data?.items || []);
      setPages(res.data?.pages || 1);
    } catch (err) {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  // 🔹 Change user role
  const changeRole = async (id, role) => {
    if (!window.confirm(`Change role to ${role}?`)) return;

    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Role update failed");
    }
  };

  // 🔹 Activate / Deactivate user
  const toggleStatus = async (id, isActive) => {
    try {
      await api.patch(`/admin/users/${id}/status`, {
        isActive: !isActive
      });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Status update failed");
    }
  };

  // 🔹 Delete user (optional)
  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user permanently?")) return;

    try {
      await api.delete(`/admin/users/${id}`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  };

  if (loading) return <p>Loading users...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by name or email"
          className="border p-2 rounded w-full md:w-80"
        />
      </div>

      <table className="w-full border bg-white text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Role</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-t">
              <td className="p-2 border">{u.name}</td>
              <td className="p-2 border">{u.email}</td>
              <td className="p-2 border capitalize">{u.role}</td>
              <td className="p-2 border">
                {u.isActive ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-red-600">Inactive</span>
                )}
              </td>

              <td className="p-2 border space-x-2">
                {/* Role change */}
                {u.role !== "admin" && (
                  <select
                    value={u.role}
                    onChange={(e) =>
                      changeRole(u._id, e.target.value)
                    }
                    className="border px-2 py-1 text-xs"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="parent">Parent</option>
                    <option value="admin">Admin</option>
                  </select>
                )}

                {/* Activate / Deactivate */}
                <button
                  onClick={() => toggleStatus(u._id, u.isActive)}
                  className="px-2 py-1 text-xs border rounded"
                >
                  {u.isActive ? "Deactivate" : "Activate"}
                </button>

                {/* Delete */}
                {u.role !== "admin" && (
                  <button
                    onClick={() => deleteUser(u._id)}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="flex gap-2 mt-4">
          {Array.from({ length: pages }, (_, i) => (
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

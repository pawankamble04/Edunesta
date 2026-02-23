import { useEffect, useState } from "react";
import api from "../../utils/axios";

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/teachers")
      .then((res) => {
        setError("");
        setTeachers(res.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load teachers");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading teachers...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Teacher Management</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <table className="w-full bg-white border-collapse text-sm">
        <thead className="bg-gray-100 border-b">
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
          </tr>
        </thead>

        <tbody>
          {teachers.map((teacher) => (
            <tr key={teacher._id} className="border-b">
              <Td>{teacher.name}</Td>
              <Td>{teacher.email}</Td>
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

import { useEffect, useState } from "react";
import api from "../../utils/axios";

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/teachers")
      .then((res) => {
        setTeachers(res.data);
      })
      .catch(() => {
        alert("Failed to load teachers");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading teachers...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">
        Teacher Management
      </h1>

      <table className="w-full bg-white border-collapse text-sm">
        <thead className="bg-gray-100 border-b">
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Department</Th>
            <Th>Tests Created</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody>
          {teachers.map((t) => (
            <tr key={t._id} className="border-b">
              <Td>{t.name}</Td>
              <Td>{t.email}</Td>
              <Td>{t.department}</Td>
              <Td>{t.testsCreated}</Td>
              <Td>
                <button className="text-blue-600 mr-3 text-xs">
                  Assign Dept
                </button>
                <button className="text-gray-600 text-xs">
                  View Activity
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
  <th className="text-left p-3 font-medium">
    {children}
  </th>
);

const Td = ({ children }) => (
  <td className="p-3">{children}</td>
);

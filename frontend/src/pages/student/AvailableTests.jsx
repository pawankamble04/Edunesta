import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../utils/axios";

export default function AvailableTests() {
  const [tests, setTests] = useState([]);

  useEffect(() => {
    api
      .get("/tests") // ✅ FIX 1: correct endpoint
      .then((res) => {
        setTests(res.data);
      })
      .catch((err) => {
        console.log("Error fetching tests:", err.response?.data || err.message);
      });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Available Tests</h1>

      <table className="w-full bg-white border">
        <thead className="bg-gray-100 text-sm">
          <tr>
            <th className="p-2">Test</th>
            <th>Duration</th>
            <th>Attempts</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody className="text-sm">
          {tests.length === 0 && (
            <tr>
              <td colSpan="4" className="p-4 text-center text-gray-500">
                No tests available
              </td>
            </tr>
          )}

          {tests.map((test) => (
            <tr key={test._id} className="border-t">
              <td className="p-2">{test.title}</td>

              {/* ✅ FIX 2: correct field name */}
              <td>{test.durationMinutes} mins</td>

              <td>{test.maxAttempts}</td>

              <td>
                <Link
                  to={`/student/attempt/${test._id}`}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Start Test
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

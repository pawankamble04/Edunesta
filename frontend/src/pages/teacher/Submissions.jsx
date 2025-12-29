import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../../services/api";

export default function Submissions() {
  const { testId } = useParams();
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    API.get(`/submissions/test/${testId}`)
      .then((res) => setSubs(res.data))
      .catch(console.error);
  }, [testId]);

  const downloadExcel = () => {
    window.open(
      `${import.meta.env.VITE_API_URL}/api/submissions/export/${testId}`,
      "_blank"
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Student Submissions</h1>

        <button
          onClick={downloadExcel}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          📥 Download Excel
        </button>
      </div>

      <table className="w-full bg-white border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3">Student</th>
            <th>Score</th>
            <th>Submitted</th>
          </tr>
        </thead>

        <tbody>
          {subs.map((s) => (
            <tr key={s._id} className="border-t">
              <td className="p-3">{s.student.name}</td>
              <td>{s.score}</td>
              <td>{new Date(s.submittedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

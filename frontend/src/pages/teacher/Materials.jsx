import { Link } from "react-router-dom";

export default function Tests() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">My Tests</h1>
        <Link
          to="/teacher/create-test"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          Create Test
        </Link>
      </div>

      <table className="w-full bg-white border">
        <thead className="bg-gray-100 text-sm">
          <tr>
            <th className="p-2">Title</th>
            <th>Duration</th>
            <th>Total Marks</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody className="text-sm">
          <tr className="border-t">
            <td className="p-2">Java Basics</td>
            <td>30 mins</td>
            <td>50</td>
            <td className="text-green-600">Active</td>
            <td className="flex gap-3 p-2">
              <Link className="text-blue-600" to="/teacher/questions">
                Questions
              </Link>
              <button className="text-red-600">Disable</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

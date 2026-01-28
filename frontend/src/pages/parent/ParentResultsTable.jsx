export default function ParentResultsTable({ results }) {
  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Test Results</h2>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Test</th>
            <th>Subject</th>
            <th>Score</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          {results.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{r.testTitle}</td>
              <td>{r.subject || "-"}</td>
              <td className="font-semibold">
                {r.score} / {r.totalMarks}
              </td>
              <td>
                {new Date(r.date).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ParentSummary({ results }) {
  // ✅ ignore invalid / old tests
  const validResults = results.filter(
    (r) => r.totalMarks && r.totalMarks > 0
  );

  const totalTests = validResults.length;

  const totalScore = validResults.reduce(
    (sum, r) => sum + r.score,
    0
  );

  const totalMarks = validResults.reduce(
    (sum, r) => sum + r.totalMarks,
    0
  );

  const averageScore =
    totalMarks > 0
      ? Math.round((totalScore / totalMarks) * 100)
      : 0;

  const performance =
    averageScore >= 75
      ? "Excellent"
      : averageScore >= 50
      ? "Good"
      : "Needs Improvement";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
      <div className="bg-white p-5 rounded shadow text-center">
        <h3 className="text-gray-500">Tests Attempted</h3>
        <p className="text-3xl font-bold">{totalTests}</p>
      </div>

      <div className="bg-white p-5 rounded shadow text-center">
        <h3 className="text-gray-500">Average Score</h3>
        <p className="text-3xl font-bold">{averageScore}%</p>
      </div>

      <div className="bg-white p-5 rounded shadow text-center">
        <h3 className="text-gray-500">Performance</h3>
        <p className="text-xl font-semibold">{performance}</p>
      </div>
    </div>
  );
}

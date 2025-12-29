import { Link } from "react-router-dom";

export default function TeacherDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Teacher Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Stat title="Tests Created" value="6" />
        <Stat title="Active Tests" value="3" />
        <Stat title="Students Attempted" value="120" />
        <Stat title="Average Score" value="74%" />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Action
          title="Create Test"
          desc="Create a new test"
          link="/teacher/create-test"
          color="blue"
        />
        <Action
          title="Manage Tests"
          desc="Edit or disable tests"
          link="/teacher/tests"
          color="purple"
        />
        {/* ✅ FIXED */}
        <Action
          title="Submissions"
          desc="View student submissions"
          link="/teacher/tests"
          color="green"
        />
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="bg-white p-6 rounded shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function Action({ title, desc, link, color }) {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700",
    purple: "bg-purple-600 hover:bg-purple-700",
    green: "bg-green-600 hover:bg-green-700",
  };

  return (
    <div className="bg-white p-6 rounded shadow flex flex-col justify-between">
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{desc}</p>
      </div>

      <Link
        to={link}
        className={`mt-4 text-white px-4 py-2 rounded w-fit ${colors[color]}`}
      >
        Open
      </Link>
    </div>
  );
}

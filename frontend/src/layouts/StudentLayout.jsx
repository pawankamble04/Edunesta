import { Outlet, Link } from "react-router-dom";

export default function StudentLayout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-green-900 text-white p-4">
        <h2 className="text-xl font-bold mb-6">Student</h2>

        <nav className="flex flex-col gap-3">
          <Link to="/student">Dashboard</Link>
          <Link to="/student/tests">Tests</Link>
          <Link to="/student/materials">Materials</Link>
          <Link to="/student/results">Results</Link>
        </nav>
      </aside>

      {/* 🔥 REQUIRED */}
      <main className="flex-1 bg-gray-100 p-6">
        <Outlet />
      </main>
    </div>
  );
}

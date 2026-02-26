import { Outlet, NavLink } from "react-router-dom";

export default function StudentLayout() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-64 bg-slate-900 text-gray-200 flex flex-col p-6 shadow-lg">
        
        {/* Logo / Title */}
        <h2 className="text-2xl font-bold text-white mb-8 tracking-wide">
          Student Panel
        </h2>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 text-sm font-medium">

          <NavItem to="/student" label="Dashboard" />
          <NavItem to="/student/ai-roadmaps" label="AI Roadmaps" />
          <NavItem to="/student/exam-auto-prep" label="JEE/NEET Prep" />
          <NavItem to="/student/pyq-practice" label="PYQ Practice" />
          <NavItem to="/student/tests" label="Tests" />
          <NavItem to="/student/results" label="Results" />
          <NavItem to="/student/materials" label="Materials" />
          <NavItem to="/student/lectures" label="Lectures" />
          <NavItem to="/student/connect" label="Connect Teacher" />

        </nav>

        {/* Footer */}
        <div className="mt-auto pt-6 text-xs text-slate-500">
          EduNesta Student v1.0
        </div>

      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 p-8 bg-gray-100">
        <Outlet />
      </main>

    </div>
  );
}

/* ================= NAV ITEM COMPONENT ================= */

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `px-4 py-2 rounded-md transition-all duration-200 ${
          isActive
            ? "bg-blue-600 text-white"
            : "hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

import { Outlet, NavLink } from "react-router-dom";

export default function ParentLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "220px",
          background: "#1e293b",
          color: "#fff",
          padding: "20px",
        }}
      >
        <h2 style={{ marginBottom: "30px" }}>Parent Panel</h2>

        <nav style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <NavLink
            to="/parent"
            end
            style={({ isActive }) => ({
              color: isActive ? "#38bdf8" : "#fff",
              textDecoration: "none",
              fontWeight: "500",
            })}
          >
            Dashboard
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: "30px",
          background: "#f8fafc",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}

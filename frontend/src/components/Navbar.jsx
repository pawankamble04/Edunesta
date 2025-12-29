import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // ✅ Read auth state
  const loadAuth = () => {
    const storedUser = localStorage.getItem("user");
    setUser(storedUser ? JSON.parse(storedUser) : null);
  };

  // ✅ Load on mount + when storage changes
  useEffect(() => {
    loadAuth();
    window.addEventListener("storage", loadAuth);
    return () => window.removeEventListener("storage", loadAuth);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // ✅ Notify app
    window.dispatchEvent(new Event("storage"));

    navigate("/login");
  };

  return (
    <nav className="bg-white shadow px-6 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg">
        EduNesta
      </Link>

      <div className="flex gap-4 items-center">
        {!user && (
          <>
            <Link to="/login" className="text-blue-600">
              Login
            </Link>
            <Link to="/register" className="text-blue-600">
              Register
            </Link>
          </>
        )}

        {user && (
          <>
            <span className="text-sm text-gray-600">
              {user.name} ({user.role})
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

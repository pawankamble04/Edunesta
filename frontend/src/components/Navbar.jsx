import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "../assets/logo.png"; 
import { clearAuth, getToken, getUser } from "../utils/storage";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 🔹 Public pages where logout should NOT appear
  const publicPages = ["/", "/login", "/register"];
  const isPublicPage = publicPages.includes(location.pathname);

  const loadAuth = () => {
    const token = getToken();
    const storedUser = getUser();

    if (token && storedUser) {
      setUser(storedUser);
    } else {
      setUser(null);
    }
  };

  // 🔹 Re-check auth on route change
  useEffect(() => {
    loadAuth();
  }, [location.pathname]);

  // 🔹 Sync across tabs
  useEffect(() => {
    window.addEventListener("storage", loadAuth);
    return () => window.removeEventListener("storage", loadAuth);
  }, []);

  const handleLogout = () => {
    clearAuth();
    window.dispatchEvent(new Event("storage"));
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-slate-900 shadow">
      <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">

        {/* LOGO */}
<img
  src={logo}
  alt="EduNesta Logo"
  className="h-40 object-contain brightness-110"
 />


        {/* USER + LOGOUT (ONLY ON DASHBOARD PAGES) */}
        {user && !isPublicPage && (
          <div className="flex gap-4 items-center text-white">
            <span className="text-sm">
              {user.name} ({user.role})
            </span>

            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

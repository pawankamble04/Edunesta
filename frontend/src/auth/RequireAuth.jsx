import { Navigate } from "react-router-dom";
import { getToken, getUser } from "../utils/storage";

export default function RequireAuth({ role, children }) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return <Navigate to="/login" />;
  }

  // 🔒 FIX: Case-insensitive role comparison
  if (role && user.role?.toLowerCase() !== role?.toLowerCase()) {
    return <Navigate to="/" />;
  }

  // ❌ Role mismatch
  if (role && user.role.toLowerCase() !== role.toLowerCase()) {
    return <Navigate to="/" replace />;
  }

  // ✅ Authorized
  return <Outlet />;
}

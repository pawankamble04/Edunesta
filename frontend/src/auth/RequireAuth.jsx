import { Navigate, Outlet } from "react-router-dom";
import { getToken, getUser } from "../utils/storage";

export default function RequireAuth({ role, children }) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role?.toLowerCase() !== role.toLowerCase()) {
    return <Navigate to="/" replace />;
  }

  if (children) {
    return children;
  }

  return <Outlet />;
}

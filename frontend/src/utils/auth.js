import api from "../utils/axios";

/**
 * Get logged-in user (safe)
 */
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

/**
 * Check login state
 * (based on user object, not token)
 */
export const isLoggedIn = () => {
  return !!localStorage.getItem("user");
};

/**
 * Logout (PRODUCTION SAFE)
 * - clears backend cookie
 * - clears frontend state
 */
export const logout = async () => {
  try {
    await api.post("/auth/logout", {}, { withCredentials: true });
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage"));
  }
};

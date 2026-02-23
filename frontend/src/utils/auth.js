import {
  clearAuth,
  getUser as getStoredUser,
  isLoggedIn as hasAuth,
} from "./storage";

export const getUser = () => getStoredUser();

export const isLoggedIn = () => hasAuth();

export const logout = () => clearAuth();

import axios from "axios";
import { clearAuth, getToken, getUser, setAuth } from "../utils/storage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api";
const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME || "XSRF-TOKEN";
const CSRF_HEADER_NAME = import.meta.env.VITE_CSRF_HEADER_NAME || "X-CSRF-Token";

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let refreshPromise = null;

const getCookieValue = (name) => {
  if (typeof document === "undefined") return "";
  const escaped = name.replace(/([.*+?^${}()|[\]\\])/g, "\\$1");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

const shouldAttachCsrf = (method) => {
  const normalized = String(method || "GET").toLowerCase();
  return ["post", "put", "patch", "delete"].includes(normalized);
};

const createQueuedRequestError = (response) => {
  const message =
    response?.data?.message ||
    "Request queued offline. It will sync automatically.";
  const error = new Error(message);
  error.name = "QueuedRequestError";
  error.isQueuedRequest = true;
  error.response = response;
  return error;
};

const isAuthEndpoint = (url) => {
  const route = String(url || "");
  return [
    "/auth/login",
    "/auth/register",
    "/auth/google",
    "/auth/logout",
    "/auth/refresh",
  ].some((entry) => route.includes(entry));
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

const getCsrfHeaders = () => {
  const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
  if (!csrfToken) return {};
  return { [CSRF_HEADER_NAME]: csrfToken };
};

const performTokenRefresh = async () => {
  const headers = getCsrfHeaders();
  const res = await refreshClient.post("/auth/refresh", {}, { headers });

  const refreshedToken = String(res.data?.token || "").trim();
  const refreshedUser = res.data?.user && typeof res.data.user === "object"
    ? res.data.user
    : getUser();

  if (!refreshedToken) {
    throw new Error("Refresh token response missing access token");
  }

  setAuth({
    token: refreshedToken,
    user: refreshedUser,
  });

  return refreshedToken;
};

API.interceptors.request.use((req) => {
  const token = getToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  if (shouldAttachCsrf(req.method)) {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
    if (csrfToken) {
      req.headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  return req;
});

API.interceptors.response.use(
  (res) => {
    if (res.status === 202 && res.data?.queued === true) {
      return Promise.reject(createQueuedRequestError(res));
    }
    return res;
  },
  async (err) => {
    const status = Number(err?.response?.status || 0);
    const originalRequest = err?.config || {};
    const requestUrl = String(originalRequest.url || "");

    if (status === 401) {
      const isRefreshRequest = requestUrl.includes("/auth/refresh");
      if (isRefreshRequest) {
        clearAuth();
        redirectToLogin();
        return Promise.reject(err);
      }

      if (isAuthEndpoint(requestUrl)) {
        return Promise.reject(err);
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          if (!refreshPromise) {
            refreshPromise = performTokenRefresh().finally(() => {
              refreshPromise = null;
            });
          }

          const refreshedToken = await refreshPromise;
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${refreshedToken}`,
          };
          return API(originalRequest);
        } catch (refreshErr) {
          clearAuth();
          redirectToLogin();
          return Promise.reject(refreshErr);
        }
      }

      clearAuth();
      redirectToLogin();
    }

    return Promise.reject(err);
  }
);

export const isQueuedRequestError = (error) =>
  Boolean(
    error?.isQueuedRequest ||
      (error?.response?.status === 202 && error?.response?.data?.queued)
  );

export const getApiErrorMessage = (
  error,
  fallback = "Request failed. Please try again."
) => {
  return error?.response?.data?.message || fallback;
};

export const aiQuestionReview = (data) => API.post("/ai/question-review", data);

export const aiWeakTopicSummary = (studentId) =>
  API.post("/ai/weak-topic-summary", { studentId });

export const aiNextSteps = (stats) => API.post("/ai/next-steps", { stats });

export default API;

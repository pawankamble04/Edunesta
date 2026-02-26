import axios from "axios";
import { clearAuth, getToken } from "../utils/storage";

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
  (err) => {
    if (err.response?.status === 401) {
      clearAuth();
      window.location.href = "/login";
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

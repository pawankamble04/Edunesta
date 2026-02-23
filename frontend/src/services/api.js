import axios from "axios";
import { clearAuth, getToken } from "../utils/storage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api";

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach token
API.interceptors.request.use((req) => {
  const token = getToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// Global error handling (optional but powerful)
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/* =========================
   AI APIs
========================= */

export const aiQuestionReview = (data) =>
  API.post("/ai/question-review", data);

export const aiWeakTopicSummary = (studentId) =>
  API.post("/ai/weak-topic-summary", { studentId });

export const aiNextSteps = (stats) =>
  API.post("/ai/next-steps", { stats });

export default API;

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import { startStaleTestAttemptCleanupScheduler } from "./utils/testAttemptCleanup.js";
import { csrfProtection, ensureCsrfCookie } from "./middleware/csrf.js";
import {
  errorContract,
  errorHandler,
  notFoundHandler,
} from "./middleware/errorContract.js";

import teacherRoutes from "./routes/teacher.js";
import authRoutes from "./routes/auth.js";
import testRoutes from "./routes/tests.js";
import questionRoutes from "./routes/questions.js";
import submissionRoutes from "./routes/submissions.js";
import materialRoutes from "./routes/materials.js";
import adminRoutes from "./routes/admin.js";
import aiRoutes from "./routes/ai.js";
import parentRoutes from "./routes/parents.js";
import analyticsRoutes from "./routes/analytics.js";
import testGemini from "./routes/testGemini.js";
import listModels from "./routes/listModels.js";
import enrollmentRoutes from "./routes/enrollments.js";
import lectureRoutes from "./routes/lectures.js";

const app = express();
const PORT = process.env.PORT || 8080;
const csrfHeaderName = process.env.CSRF_HEADER_NAME || "X-CSRF-Token";
const corsAllowedHeaders = Array.from(
  new Set(["Content-Type", "Authorization", csrfHeaderName].filter(Boolean))
);
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const resolveTrustProxySetting = () => {
  const raw = String(process.env.TRUST_PROXY || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) return asNumber;
  return raw;
};

const isLocalDevOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalized = origin.replace(/\/+$/, "");

  if (allowedOrigins.length === 0) {
    return isLocalDevOrigin(normalized);
  }

  return allowedOrigins.includes(normalized);
};

connectDB();
startStaleTestAttemptCleanupScheduler();
app.set("trust proxy", resolveTrustProxySetting());

app.use(
  cors({
    credentials: true,
    allowedHeaders: corsAllowedHeaders,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
  })
);
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(errorContract);
app.use(ensureCsrfCookie);
app.use(csrfProtection);

app.use("/api/auth", authRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/lectures", lectureRoutes);

if (
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_ROUTES === "true"
) {
  app.use("/api", testGemini);
  app.use("/api", listModels);
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "EduNesta Backend",
    environment: process.env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

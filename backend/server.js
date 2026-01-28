import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// =======================
// DATABASE
// =======================
import connectDB from "./config/db.js";

// =======================
// ROUTES
// =======================
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

// =======================
// FIX __dirname (ESM)
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================
// APP INIT
// =======================
const app = express();
const PORT = process.env.PORT || 8080;

// =======================
// TRUST PROXY (REQUIRED FOR HTTPS COOKIES)
// =======================
app.set("trust proxy", 1);

// =======================
// CONNECT DATABASE
// =======================
connectDB();

// =======================
// MIDDLEWARES (ORDER MATTERS)
// =======================
app.use(
  cors({
    origin: [
      "http://localhost:5173",              // local frontend
      "https://your-frontend-domain.com"    // 🔁 replace after deploy
    ],
    credentials: true
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// STATIC FILES
// =======================
app.use(
  "/uploads",
  express.static(
    path.join(__dirname, process.env.UPLOAD_DIR || "uploads")
  )
);

// =======================
// API ROUTES
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/analytics", analyticsRoutes);

// Debug / test routes
app.use("/api", testGemini);
app.use("/api", listModels);

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "EduNesta Backend",
    environment: process.env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

// =======================
// GLOBAL ERROR HANDLER
// =======================
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("MongoDB:", process.env.MONGO_URI ? "CONNECTED" : "NOT SET");
  console.log(
    "Gemini API Key:",
    process.env.GEMINI_API_KEY ? "LOADED" : "NOT SET"
  );
});

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// DB
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.js";
import testRoutes from "./routes/tests.js";
import questionRoutes from "./routes/questions.js";
import submissionRoutes from "./routes/submissions.js";
import materialRoutes from "./routes/materials.js";
import adminRoutes from "./routes/admin.js";
import aiRoutes from "./routes/ai.js";
import testGemini from "./routes/testGemini.js";
import listModels from "./routes/listModels.js"; // ✅ ADD THIS

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create app
const app = express();
const PORT = process.env.PORT || 8080;

// =======================
// CONNECT DATABASE
// =======================
connectDB();

// =======================
// MIDDLEWARES
// =======================
app.use(cors());
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

// ✅ DEBUG / TEST ROUTES
app.use("/api", testGemini);
app.use("/api", listModels); // ✅ THIS FIXES /api/list-models

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "EduNesta Backend",
    time: new Date().toISOString(),
  });
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    "Gemini Key Loaded:",
    process.env.GEMINI_API_KEY ? "YES" : "NO"
  );
});

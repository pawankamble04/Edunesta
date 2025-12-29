import express from "express";
import { protect } from "../middleware/auth.js";
import { permit } from "../middleware/roles.js";

import {
  submitTest,
  getSubmissionsForTest,
  getMyResults,
  exportSubmissionsExcel,
} from "../controllers/submissionController.js";

const router = express.Router();

// ===============================
// Student submits test
// ===============================
router.post("/", protect, permit("student"), submitTest);

// ===============================
// Student results history
// ===============================
router.get("/my", protect, permit("student"), getMyResults);

// ===============================
// Teacher views submissions for a test
// ===============================
router.get(
  "/test/:testId",
  protect,
  permit("teacher"),
  getSubmissionsForTest
);

// ===============================
// Teacher exports submissions as Excel
// ===============================
router.get(
  "/export/:testId",
  protect,
  permit("teacher"),
  exportSubmissionsExcel
);

export default router;

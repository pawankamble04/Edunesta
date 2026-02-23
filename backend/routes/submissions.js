import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import { objectIdParamSchema, submitTestSchema } from "../validation/schemas.js";

import {
  submitTest,
  getSubmissionsForTest,
  getMyResults,
  getMyDailyStatus,
  exportSubmissionsExcel,
} from "../controllers/submissionController.js";

const router = express.Router();

// ===============================
// Student submits test
// ===============================
router.post(
  "/submit",
  protect,
  authorize("student"),
  validate(submitTestSchema),
  submitTest
);

// ===============================
// Student results history
// ===============================
router.get(
  "/my",
  protect,
  authorize("student"),
  getMyResults
);

// ===============================
// Student daily status (today only)
// ===============================
router.get(
  "/daily-status",
  protect,
  authorize("student"),
  getMyDailyStatus
);

// ===============================
// Teacher views submissions for a test
// ===============================
router.get(
  "/test/:testId",
  protect,
  authorize("teacher"),
  validate(objectIdParamSchema("testId")),
  getSubmissionsForTest
);

// ===============================
// Teacher exports submissions as Excel
// ===============================
router.get(
  "/export/:testId",
  protect,
  authorize("teacher"),
  validate(objectIdParamSchema("testId")),
  exportSubmissionsExcel
);

export default router;

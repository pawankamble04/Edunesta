import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  createTestSchema,
  objectIdParamSchema,
} from "../validation/schemas.js";

import {
  createTest,
  getTest,
  listTests,
  togglePublishTest,
} from "../controllers/testController.js";

const router = express.Router();

// ===============================
// Create Test (Teacher / Admin)
// ===============================
router.post(
  "/",
  protect,
  authorize("teacher", "admin"),
  validate(createTestSchema),
  createTest
);

// ===============================
// List Tests (Role-aware in controller)
// ===============================
router.get("/", protect, authorize("teacher", "student", "admin"), listTests);

// ===============================
// Get Single Test
// ===============================
router.get(
  "/:id",
  protect,
  authorize("teacher", "student", "admin"),
  validate(objectIdParamSchema("id")),
  getTest
);

// ===============================
// Publish / Unpublish (Teacher only)
// ===============================
router.put(
  "/:id/publish",
  protect,
  authorize("teacher", "admin"),
  validate(objectIdParamSchema("id")),
  togglePublishTest
);

export default router;

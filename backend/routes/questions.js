import express from "express";
import { protect } from "../middleware/auth.js";
import { permit } from "../middleware/roles.js";

import {
  addQuestion,
  getQuestionsByTest,
  updateQuestion,
  deleteQuestion,
} from "../controllers/questionController.js";

const router = express.Router();

// Teacher adds question
router.post("/:testId", protect, permit("teacher"), addQuestion);

// Teacher / Student fetch questions
router.get("/:testId", protect, getQuestionsByTest);

// ✅ UPDATE question (Teacher only)
router.put("/:id", protect, permit("teacher"), updateQuestion);

// ✅ DELETE question (Teacher only)
router.delete("/:id", protect, permit("teacher"), deleteQuestion);

export default router;

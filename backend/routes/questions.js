import express from "express";
import { protect } from "../middleware/auth.js";
import { permit } from "../middleware/roles.js";

import {
  addQuestion,
  getQuestionsByTest,
} from "../controllers/questionController.js";

const router = express.Router();

// Teacher adds question
router.post("/:testId", protect, permit("teacher"), addQuestion);

// Teacher / Student fetch questions
router.get("/:testId", protect, getQuestionsByTest);

export default router;

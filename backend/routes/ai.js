import express from "express";
import {
  reviewQuestion,
  weakTopicSummary,
  nextStepSuggestions,
} from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/question-review", protect, reviewQuestion);
router.post("/weak-topic-summary", protect, weakTopicSummary);
router.post("/next-steps", protect, nextStepSuggestions);

export default router;

import express from "express";
import {
  reviewQuestion,
  weakTopicSummary,
  nextStepSuggestions,
  generateWeeklyPlan,
  getWeeklyPlanHistory,
} from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();
const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 25,
  keyPrefix: "ai",
  message: "AI request limit reached. Please try again shortly.",
});

router.post(
  "/question-review",
  aiLimiter,
  protect,
  authorize("teacher", "admin"),
  reviewQuestion
);
router.post(
  "/weak-topic-summary",
  aiLimiter,
  protect,
  authorize("student", "parent", "admin"),
  weakTopicSummary
);
router.post(
  "/next-steps",
  aiLimiter,
  protect,
  authorize("student", "parent", "admin"),
  nextStepSuggestions
);
router.post(
  "/weekly-plan",
  aiLimiter,
  protect,
  authorize("student"),
  generateWeeklyPlan
);
router.get(
  "/weekly-plan/history",
  protect,
  authorize("student"),
  getWeeklyPlanHistory
);

export default router;

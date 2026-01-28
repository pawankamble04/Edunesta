import express from "express";
import {
  getStudentAnalytics,
  getParentAnalytics,
  getTeacherAnalytics,
} from "../controllers/analyticsController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * ================================
 * STUDENT ANALYTICS
 * ================================
 * Student can see ONLY their own analytics
 */
router.get(
  "/student",
  protect,
  (req, res, next) => {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  getStudentAnalytics
);

/**
 * ================================
 * PARENT ANALYTICS
 * ================================
 * Parent can see ONLY linked student's analytics
 */
router.get(
  "/parent",
  protect,
  (req, res, next) => {
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  getParentAnalytics
);

/**
 * ================================
 * TEACHER ANALYTICS
 * ================================
 * Teacher can see analytics for a specific test
 */
router.get(
  "/teacher/:testId",
  protect,
  (req, res, next) => {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  getTeacherAnalytics
);

export default router;

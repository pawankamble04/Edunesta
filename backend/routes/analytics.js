import express from "express";
import {
  getStudentAnalytics,
  getStudentTopicMastery,
  generateStudentMicroRetest,
  submitStudentMicroRetest,
  generateStudentPyqPractice,
  submitStudentPyqPractice,
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

router.get(
  "/student/topic-mastery",
  protect,
  (req, res, next) => {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  getStudentTopicMastery
);

router.post(
  "/student/micro-retest",
  protect,
  (req, res, next) => {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  generateStudentMicroRetest
);

router.post(
  "/student/micro-retest/submit",
  protect,
  (req, res, next) => {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  submitStudentMicroRetest
);

router.post(
  "/student/pyq-practice",
  protect,
  (req, res, next) => {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  generateStudentPyqPractice
);

router.post(
  "/student/pyq-practice/submit",
  protect,
  (req, res, next) => {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  submitStudentPyqPractice
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

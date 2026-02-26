import express from "express";
import multer from "multer";
import {
  reviewQuestion,
  generateMcqFromParagraph,
  generateMcqFromPdf,
  generateCodingRoadmap,
  getCodingRoadmapHistory,
  downloadCodingRoadmapPdf,
  generateExamAutoPlan,
  getExamAutoPlanHistory,
  downloadExamAutoPlanPdf,
  getTeacherExamAutoPlanOverview,
  getParentExamAutoPlanOverview,
  weakTopicSummary,
  nextStepSuggestions,
  studyBuddyChat,
  getStudyBuddyHistory,
  clearStudyBuddyHistory,
  generateWeeklyPlan,
  getWeeklyPlanHistory,
} from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { hasPdfExtension, isPdfMimeType } from "../utils/pdfSecurity.js";

const router = express.Router();
const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 25,
  keyPrefix: "ai",
  message: "AI request limit reached. Please try again shortly.",
});
const aiPdfUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_, file, cb) => {
    const isPdf =
      isPdfMimeType(file?.mimetype) && hasPdfExtension(file?.originalname);
    if (isPdf) return cb(null, true);

    const err = new Error("Only PDF files are allowed");
    err.statusCode = 400;
    return cb(err);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});
const aiPdfUploadMiddleware = (req, res, next) => {
  aiPdfUpload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      err.statusCode = 413;
      err.message = "PDF must be 5MB or smaller";
    } else if (!err.statusCode) {
      err.statusCode = 400;
    }
    return next(err);
  });
};

router.post(
  "/question-review",
  aiLimiter,
  protect,
  authorize("teacher", "admin"),
  reviewQuestion
);
router.post(
  "/mcq-from-paragraph",
  aiLimiter,
  protect,
  authorize("teacher", "admin"),
  generateMcqFromParagraph
);
router.post(
  "/mcq-from-pdf",
  aiLimiter,
  protect,
  authorize("teacher", "admin"),
  aiPdfUploadMiddleware,
  generateMcqFromPdf
);
router.post(
  "/coding-roadmap",
  aiLimiter,
  protect,
  authorize("student"),
  generateCodingRoadmap
);
router.get(
  "/coding-roadmap/history",
  protect,
  authorize("student"),
  getCodingRoadmapHistory
);
router.get(
  "/coding-roadmap/:id/pdf",
  protect,
  authorize("student"),
  downloadCodingRoadmapPdf
);
router.post(
  "/exam-auto-plan",
  aiLimiter,
  protect,
  authorize("student"),
  generateExamAutoPlan
);
router.get(
  "/exam-auto-plan/history",
  protect,
  authorize("student"),
  getExamAutoPlanHistory
);
router.get(
  "/exam-auto-plan/:id/pdf",
  protect,
  authorize("student"),
  downloadExamAutoPlanPdf
);
router.get(
  "/exam-auto-plan/teacher/overview",
  protect,
  authorize("teacher"),
  getTeacherExamAutoPlanOverview
);
router.get(
  "/exam-auto-plan/parent/overview",
  protect,
  authorize("parent"),
  getParentExamAutoPlanOverview
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
  "/study-buddy/chat",
  aiLimiter,
  protect,
  authorize("student", "teacher", "parent"),
  studyBuddyChat
);
router.get(
  "/study-buddy/history",
  protect,
  authorize("student", "teacher", "parent"),
  getStudyBuddyHistory
);
router.delete(
  "/study-buddy/history",
  protect,
  authorize("student", "teacher", "parent"),
  clearStudyBuddyHistory
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

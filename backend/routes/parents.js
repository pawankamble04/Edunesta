import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  objectIdParamSchema,
  parentLinkStudentSchema,
} from "../validation/schemas.js";

import {
  getParentDashboard,
  getParentChildren,
  getParentResultsByChild,
  getParentAISummary,
  linkStudentByCode,
  getParentDailyNotifications,
} from "../controllers/parentController.js";


const router = express.Router();

// 🔐 Parent Dashboard (results view)
router.get(
  "/dashboard",
  protect,
  authorize("parent"),
  getParentDashboard
);

// 👶 Parent → Children
router.get(
  "/children",
  protect,
  authorize("parent"),
  getParentChildren
);

// 📊 Parent → Results per child
router.get(
  "/results/:studentId",
  protect,
  authorize("parent"),
  validate(objectIdParamSchema("studentId")),
  getParentResultsByChild
);

// 🧠 Parent → AI performance summary
router.get(
  "/ai-summary/:studentId",
  protect,
  authorize("parent"),
  validate(objectIdParamSchema("studentId")),
  getParentAISummary
);

router.get(
  "/notifications/daily",
  protect,
  authorize("parent"),
  getParentDailyNotifications
);

router.post(
  "/link",
  protect,
  authorize("parent"),
  validate(parentLinkStudentSchema),
  linkStudentByCode
);

export default router;

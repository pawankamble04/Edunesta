import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  addTeacherSubjectSchema,
  removeTeacherSubjectSchema,
  teacherJoinCodeParamSchema,
} from "../validation/schemas.js";

import {
  getTeacherDashboard,
  getMySubjects,
  addSubject,
  removeSubject,
  getSubjectsByJoinCode,
} from "../controllers/teacherController.js";

const router = express.Router();

/* =========================================
   TEACHER DASHBOARD
========================================= */

router.get(
  "/dashboard",
  protect,
  authorize("teacher"),
  getTeacherDashboard
);

/* =========================================
   TEACHER SUBJECT MANAGEMENT
========================================= */

// GET my subjects (Teacher only)
router.get(
  "/subjects",
  protect,
  authorize("teacher"),
  getMySubjects
);

// ADD subject (Teacher only)
router.post(
  "/subjects",
  protect,
  authorize("teacher"),
  validate(addTeacherSubjectSchema),
  addSubject
);

// REMOVE subject (Teacher only)
router.delete(
  "/subjects/:subject",
  protect,
  authorize("teacher"),
  validate(removeTeacherSubjectSchema),
  removeSubject
);

/* =========================================
   STUDENT - FETCH SUBJECTS BY JOIN CODE
========================================= */

// Student enters join code → fetch teacher subjects
router.get(
  "/subjects-by-code/:joinCode",
  protect,
  authorize("student"),
  validate(teacherJoinCodeParamSchema),
  getSubjectsByJoinCode
);

export default router;

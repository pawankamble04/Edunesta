import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  connectStudentByTeacherSchema,
  connectToTeacherSchema,
} from "../validation/schemas.js";

import {
  connectToTeacher,
  listMyStudents,
  listMyTeachers,
  connectStudentByTeacher,
} from "../controllers/enrollmentController.js";

const router = express.Router();

/* =========================================
   STUDENT – Connect to Teacher
========================================= */
router.post(
  "/connect",
  protect,
  authorize("student"),
  validate(connectToTeacherSchema),
  connectToTeacher
);

/* =========================================
   TEACHER – View My Students
========================================= */
router.get(
  "/students",
  protect,
  authorize("teacher"),
  listMyStudents
);

/* =========================================
   STUDENT – View My Teachers
========================================= */
router.get(
  "/teachers",
  protect,
  authorize("student"),
  listMyTeachers
);

/* =========================================
   TEACHER - CONNECT SPECIFIC STUDENT
========================================= */
router.post(
  "/connect-student",
  protect,
  authorize("teacher"),
  validate(connectStudentByTeacherSchema),
  connectStudentByTeacher
);

export default router;

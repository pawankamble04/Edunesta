import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  createLectureSchema,
  updateLectureSchema,
  updateLecturePublishSchema,
  teacherLecturesQuerySchema,
  studentLecturesQuerySchema,
  objectIdParamSchema,
} from "../validation/schemas.js";
import {
  createLecture,
  listTeacherLectures,
  updateLecture,
  setLecturePublishState,
  deleteLecture,
  listStudentLectures,
  markLectureViewed,
  getLectureAttendance,
} from "../controllers/lectureController.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("teacher"),
  validate(createLectureSchema),
  createLecture
);

router.get(
  "/teacher",
  protect,
  authorize("teacher"),
  validate(teacherLecturesQuerySchema),
  listTeacherLectures
);

router.get(
  "/student",
  protect,
  authorize("student"),
  validate(studentLecturesQuerySchema),
  listStudentLectures
);

router.post(
  "/:id/view",
  protect,
  authorize("student"),
  validate(objectIdParamSchema("id")),
  markLectureViewed
);

router.get(
  "/:id/attendance",
  protect,
  authorize("teacher"),
  validate(objectIdParamSchema("id")),
  getLectureAttendance
);

router.put(
  "/:id",
  protect,
  authorize("teacher"),
  validate(updateLectureSchema),
  updateLecture
);

router.patch(
  "/:id/publish",
  protect,
  authorize("teacher"),
  validate(updateLecturePublishSchema),
  setLecturePublishState
);

router.delete(
  "/:id",
  protect,
  authorize("teacher"),
  validate(objectIdParamSchema("id")),
  deleteLecture
);

export default router;

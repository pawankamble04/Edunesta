import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  objectIdParamSchema,
  uploadMaterialSchema,
} from "../validation/schemas.js";

import {
  upload,
  uploadMaterialHandler,
  listStudentMaterials,
  listTeacherMaterials,
  downloadMaterialFile,
} from "../controllers/materialController.js";

const router = express.Router();

// Teacher uploads material
router.post(
  "/",
  protect,
  authorize("teacher"),
  upload.single("file"),
  validate(uploadMaterialSchema),
  uploadMaterialHandler
);

// Protected material file access (student/teacher/admin)
router.get(
  "/:id/file",
  protect,
  authorize("student", "teacher", "admin"),
  validate(objectIdParamSchema("id")),
  downloadMaterialFile
);

// Student views materials
router.get(
  "/student",
  protect,
  authorize("student"),
  listStudentMaterials
);

// Teacher views own materials
router.get(
  "/teacher",
  protect,
  authorize("teacher"),
  listTeacherMaterials
);

export default router;

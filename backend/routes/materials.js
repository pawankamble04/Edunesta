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
const uploadMaterialPdf = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
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

// Teacher uploads material
router.post(
  "/",
  protect,
  authorize("teacher"),
  uploadMaterialPdf,
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

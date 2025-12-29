import express from "express";
import { protect } from "../middleware/auth.js";
import { permit } from "../middleware/roles.js";

import {
  upload,
  uploadMaterialHandler,
  listStudentMaterials,
  listTeacherMaterials,
} from "../controllers/materialController.js";

const router = express.Router();

router.post(
  "/",
  protect,
  permit("teacher"),
  upload.single("file"),
  uploadMaterialHandler
);

router.get("/student", protect, permit("student"), listStudentMaterials);
router.get("/teacher", protect, permit("teacher"), listTeacherMaterials);

export default router;

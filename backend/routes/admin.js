import express from "express";
import { protect } from "../middleware/auth.js";
import { permit } from "../middleware/roles.js";

import {
  // DASHBOARD
  getDashboardStats,

  // USER MANAGEMENT
  getAllUsers,
  changeUserRole,
  updateUserStatus,
  deleteUser,

  // TEACHER MANAGEMENT
  getTeachers,

  // MATERIAL MODERATION
  getAllMaterials,
  toggleMaterialStatus,
  deleteMaterial,
} from "../controllers/adminController.js";

const router = express.Router();

// ======================
// DASHBOARD
// ======================
router.get("/dashboard", protect, permit("admin"), getDashboardStats);

// ======================
// USER MANAGEMENT
// ======================
router.get("/users", protect, permit("admin"), getAllUsers);
router.patch("/users/:id/role", protect, permit("admin"), changeUserRole);
router.patch("/users/:id/status", protect, permit("admin"), updateUserStatus);
router.delete("/users/:id", protect, permit("admin"), deleteUser);

// ======================
// TEACHER MANAGEMENT
// ======================
router.get("/teachers", protect, permit("admin"), getTeachers);

// ======================
// MATERIAL MODERATION
// ======================
router.get("/materials", protect, permit("admin"), getAllMaterials);
router.patch(
  "/materials/:id/status",
  protect,
  permit("admin"),
  toggleMaterialStatus
);
router.delete(
  "/materials/:id",
  protect,
  permit("admin"),
  deleteMaterial
);

export default router;

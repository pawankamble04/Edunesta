import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  adminUsersQuerySchema,
  auditLogsQuerySchema,
  changeUserRoleSchema,
  cleanupStaleTestAttemptsQuerySchema,
  objectIdParamSchema,
  updateUserStatusSchema,
} from "../validation/schemas.js";

import {
  getDashboardStats,
  getAllUsers,
  changeUserRole,
  updateUserStatus,
  deleteUser,
  getTeachers,
  getAllMaterials,
  toggleMaterialStatus,
  deleteMaterial,
  getAuditLogs,
  deleteStaleTestAttempts,
} from "../controllers/adminController.js";

const router = express.Router();

// ======================
// DASHBOARD
// ======================
router.get("/dashboard", protect, authorize("admin"), getDashboardStats);
router.get(
  "/logs",
  protect,
  authorize("admin"),
  validate(auditLogsQuerySchema),
  getAuditLogs
);

// ======================
// USER MANAGEMENT
// ======================
router.get(
  "/users",
  protect,
  authorize("admin"),
  validate(adminUsersQuerySchema),
  getAllUsers
);
router.patch(
  "/users/:id/role",
  protect,
  authorize("admin"),
  validate(changeUserRoleSchema),
  changeUserRole
);
router.patch(
  "/users/:id/status",
  protect,
  authorize("admin"),
  validate(updateUserStatusSchema),
  updateUserStatus
);
router.delete(
  "/users/:id",
  protect,
  authorize("admin"),
  validate(objectIdParamSchema("id")),
  deleteUser
);

// ======================
// TEACHER MANAGEMENT
// ======================
router.get("/teachers", protect, authorize("admin"), getTeachers);

// ======================
// MATERIAL MODERATION
// ======================
router.get("/materials", protect, authorize("admin"), getAllMaterials);
router.patch(
  "/materials/:id/status",
  protect,
  authorize("admin"),
  validate(objectIdParamSchema("id")),
  toggleMaterialStatus
);
router.delete(
  "/materials/:id",
  protect,
  authorize("admin"),
  validate(objectIdParamSchema("id")),
  deleteMaterial
);

// ======================
// MAINTENANCE
// ======================
router.delete(
  "/test-attempts/stale",
  protect,
  authorize("admin"),
  validate(cleanupStaleTestAttemptsQuerySchema),
  deleteStaleTestAttempts
);

export default router;

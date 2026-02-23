import User from "../models/User.js";
import Test from "../models/Test.js";
import Submission from "../models/Submission.js";
import Material from "../models/Material.js";
import AuditLog from "../models/AuditLog.js";
import { writeAuditLog } from "../utils/audit.js";
import { generateUniqueTeacherJoinCode } from "../utils/teacherJoinCode.js";
import { cleanupStaleTestAttempts } from "../utils/testAttemptCleanup.js";

const getActorFromReq = (req) => ({
  _id: req.user?._id || req.user?.id,
  name: req.user?.name || "",
  email: req.user?.email || "",
  role: req.user?.role,
});

/* ================= DASHBOARD ================= */
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTeachers = await User.countDocuments({ role: "teacher" });
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalTests = await Test.countDocuments();
    const totalSubmissions = await Submission.countDocuments();

    res.json({
      totalUsers,
      totalTeachers,
      totalStudents,
      totalTests,
      totalSubmissions,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= USERS ================= */
export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const search = String(req.query.search || "").trim();

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      items: users,
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const changeUserRole = async (req, res) => {
  try {
    const allowedRoles = new Set([
      "student",
      "teacher",
      "parent",
      "admin",
    ]);
    const role = String(req.body.role || "").toLowerCase();

    if (!allowedRoles.has(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (String(req.params.id) === String(req.user._id) && role !== "admin") {
      return res.status(400).json({
        message: "You cannot remove your own admin role",
      });
    }

    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = role;

    if (role === "teacher" && !user.teacherJoinCode) {
      user.teacherJoinCode = await generateUniqueTeacherJoinCode();
    }

    await user.save();

    await writeAuditLog({
      action: "admin.user.role_changed",
      actor: getActorFromReq(req),
      target: "user",
      targetId: user._id,
      meta: { newRole: role, userEmail: user.email },
    });

    res.json(user);
  } catch (err) {
    console.error("Change role error:", err);
    res.status(500).json({ message: "Failed to update role" });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id) && req.body.isActive === false) {
      return res.status(400).json({
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await writeAuditLog({
      action: "admin.user.status_updated",
      actor: getActorFromReq(req),
      target: "user",
      targetId: user._id,
      meta: { isActive: user.isActive, userEmail: user.email },
    });

    res.json(user);
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await writeAuditLog({
      action: "admin.user.deleted",
      actor: getActorFromReq(req),
      target: "user",
      targetId: user._id,
      meta: {
        deletedEmail: user.email,
        deletedRole: user.role,
      },
    });

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

/* ================= TEACHERS ================= */
export const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" }).select(
      "name email"
    );
    res.json(teachers);
  } catch (err) {
    console.error("Get teachers error:", err);
    res.status(500).json({ message: "Failed to fetch teachers" });
  }
};

/* ================= MATERIALS ================= */
export const getAllMaterials = async (req, res) => {
  try {
    const materials = await Material.find()
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(materials);
  } catch (err) {
    console.error("Get materials error:", err);
    res.status(500).json({ message: "Failed to fetch materials" });
  }
};

export const toggleMaterialStatus = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    material.isActive = !material.isActive;
    await material.save();

    await writeAuditLog({
      action: "admin.material.status_toggled",
      actor: getActorFromReq(req),
      target: "material",
      targetId: material._id,
      meta: { isActive: material.isActive, title: material.title },
    });

    res.json(material);
  } catch (err) {
    console.error("Toggle material error:", err);
    res.status(500).json({ message: "Failed to update material" });
  }
};

export const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    await writeAuditLog({
      action: "admin.material.deleted",
      actor: getActorFromReq(req),
      target: "material",
      targetId: material._id,
      meta: { title: material.title },
    });

    res.json({ message: "Material deleted" });
  } catch (err) {
    console.error("Delete material error:", err);
    res.status(500).json({ message: "Failed to delete material" });
  }
};

/* ================= LOGS ================= */
export const getAuditLogs = async (req, res) => {
  try {
    const { action, target } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const parsedLimit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const query = {};
    if (action) query.action = action;
    if (target) query.target = target;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * parsedLimit)
        .limit(parsedLimit),
    ]);

    return res.json({
      items: logs,
      page,
      limit: parsedLimit,
      total,
      pages: Math.max(Math.ceil(total / parsedLimit), 1),
    });
  } catch (err) {
    console.error("Get audit logs error:", err);
    return res.status(500).json({ message: "Failed to fetch logs" });
  }
};

/* ================= MAINTENANCE ================= */
export const deleteStaleTestAttempts = async (req, res) => {
  try {
    const graceHours = req.query.graceHours;
    const limit = req.query.limit;

    const result = await cleanupStaleTestAttempts({
      graceHours,
      limit,
    });

    await writeAuditLog({
      action: "admin.test_attempts.stale_cleanup",
      actor: getActorFromReq(req),
      target: "test_attempt",
      meta: result,
    });

    return res.json({
      message: "Stale test attempts cleaned successfully",
      ...result,
    });
  } catch (err) {
    console.error("Delete stale test attempts error:", err);
    return res.status(500).json({
      message: "Failed to clean stale test attempts",
    });
  }
};

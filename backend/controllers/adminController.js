import User from "../models/User.js";
import Test from "../models/Test.js";
import Submission from "../models/Submission.js";
import Material from "../models/Material.js";

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
    res.status(500).json({ msg: "Server error" });
  }
};

/* ================= USERS ================= */
export const getAllUsers = async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
};

export const changeUserRole = async (req, res) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select("-password");
  res.json(user);
};

export const updateUserStatus = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: req.body.isActive },
    { new: true }
  ).select("-password");
  res.json(user);
};

export const deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ msg: "User deleted" });
};

/* ================= TEACHERS ================= */
export const getTeachers = async (req, res) => {
  const teachers = await User.find({ role: "teacher" }).select("name email");
  res.json(teachers);
};

/* ================= MATERIALS ================= */
export const getAllMaterials = async (req, res) => {
  const materials = await Material.find()
    .populate("uploadedBy", "name email")
    .sort({ createdAt: -1 });
  res.json(materials);
};

export const toggleMaterialStatus = async (req, res) => {
  const material = await Material.findById(req.params.id);
  material.isActive = !material.isActive;
  await material.save();
  res.json(material);
};

export const deleteMaterial = async (req, res) => {
  await Material.findByIdAndDelete(req.params.id);
  res.json({ msg: "Material deleted" });
};

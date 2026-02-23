import Material from "../models/Material.js";
import Enrollment from "../models/Enrollment.js";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads", "materials");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    cb(new Error("Only PDF files are allowed"), false);
  } else {
    cb(null, true);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ===============================
   Upload Material (Teacher Only)
================================ */
export const uploadMaterialHandler = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const material = await Material.create({
      title: req.body.title,
      description: req.body.description,
      fileUrl: `/uploads/materials/${req.file.filename}`,
      uploadedBy: req.user._id,
      visibleTo: req.body.visibleTo || "students",
      isActive: true,
    });

    res.json(material);
  } catch (err) {
    console.error("Upload material error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
};

/* ===============================
   Download Material File (Protected)
================================ */
export const downloadMaterialFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    const role = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid material ID" });
    }

    const material = await Material.findById(id).select(
      "title fileUrl uploadedBy visibleTo isActive"
    );

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    if (role === "teacher") {
      if (String(material.uploadedBy) !== String(userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (role === "student") {
      if (!material.isActive || !["students", "all"].includes(material.visibleTo)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const hasEnrollment = await Enrollment.exists({
        student: userId,
        teacher: material.uploadedBy,
      });

      if (!hasEnrollment) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const filename = path.basename(String(material.fileUrl || ""));
    const filePath = path.join(uploadDir, filename);

    if (!filename || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    const safeTitle = String(material.title || "material").replace(
      /[^a-zA-Z0-9-_]/g,
      "_"
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeTitle}.pdf"`);
    return res.sendFile(filePath);
  } catch (err) {
    console.error("Download material error:", err);
    return res.status(500).json({ message: "Failed to download material" });
  }
};

/* ===============================
   Student → View Materials
================================ */
export const listStudentMaterials = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }

    const enrollments = await Enrollment.find({
      student: req.user._id,
    });

    if (!enrollments.length) {
      return res.json([]);
    }

    const teacherIds = enrollments.map((e) => e.teacher);

    const items = await Material.find({
      uploadedBy: { $in: teacherIds },
      isActive: true,
      visibleTo: { $in: ["students", "all"] },
    });

    res.json(items);
  } catch (err) {
    console.error("List student materials error:", err);
    res.status(500).json({ message: "Failed to fetch materials" });
  }
};

/* ===============================
   Teacher → View Own Materials
================================ */
export const listTeacherMaterials = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const items = await Material.find({
      uploadedBy: req.user._id,
    });

    res.json(items);
  } catch (err) {
    console.error("List teacher materials error:", err);
    res.status(500).json({ message: "Failed to fetch materials" });
  }
};

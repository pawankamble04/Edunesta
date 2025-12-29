import Material from "../models/Material.js";
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
  filename: (_, __, cb) => cb(null, Date.now() + ".pdf"),
});

export const upload = multer({ storage });

export const uploadMaterialHandler = async (req, res) => {
  const material = await Material.create({
    title: req.body.title,
    description: req.body.description,
    fileUrl: `/uploads/materials/${req.file.filename}`,
    uploadedBy: req.user.id,
    visibleTo: req.body.visibleTo || "students",
  });
  res.json(material);
};

export const listStudentMaterials = async (req, res) => {
  const items = await Material.find({ isActive: true });
  res.json(items);
};

export const listTeacherMaterials = async (req, res) => {
  const items = await Material.find({ uploadedBy: req.user.id });
  res.json(items);
};

import express from "express";
import auth from "../middleware/auth.js";
import { getParentDashboard } from "../controllers/parentController.js";

const router = express.Router();

// Parent Dashboard (Student + Results)
router.get("/dashboard", auth, getParentDashboard);

export default router;

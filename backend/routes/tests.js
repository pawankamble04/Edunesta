import express from "express";
import { protect } from "../middleware/auth.js";
import { permit } from "../middleware/roles.js";

import {
  createTest,
  getTest,
  publishTest,
  listTests,
} from "../controllers/testController.js";

const router = express.Router();

router.post("/", protect, permit("teacher", "admin"), createTest);
router.get("/", protect, listTests);
router.post("/:id/publish", protect, permit("teacher", "admin"), publishTest);
router.get("/:id", protect, getTest); // KEEP LAST

export default router;

import express from "express";
import { protect } from "../middleware/auth.js";
import { permit } from "../middleware/roles.js";
import { togglePublishTest } from "../controllers/testController.js";


import {
  createTest,
  getTest,
  publishTest,
  listTests,
} from "../controllers/testController.js";

const router = express.Router();

router.post("/", protect, permit("teacher", "admin"), createTest);
router.get("/", protect, listTests);
router.get("/:id", protect, getTest); // KEEP LAST

// ===============================
// Teacher publish / unpublish test
// ===============================
router.put(
  "/:id/publish",
  protect,
  permit("teacher"),
  togglePublishTest
);


export default router;

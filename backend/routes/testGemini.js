import express from "express";
import { askGemini } from "../utils/gemini.js";

const router = express.Router();

router.get("/test-gemini", async (req, res) => {
  try {
    const reply = await askGemini("Say hello in one short sentence.");
    res.json({ success: true, reply });
  } catch (err) {
    console.error("❌ TEST GEMINI ERROR:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;

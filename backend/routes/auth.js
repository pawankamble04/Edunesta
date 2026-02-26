import express from "express";
import {
  register,
  login,
  googleAuth,
  generateStudentLinkCode,
  getMe,
  logout,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  googleAuthSchema,
  loginSchema,
  registerSchema,
} from "../validation/schemas.js";

const router = express.Router();
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyPrefix: "auth",
  message: "Too many auth requests. Try again in a few minutes.",
});
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyPrefix: "auth-login",
  message: "Too many login attempts. Try again later.",
});

// ================= AUTH =================
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/google", authLimiter, validate(googleAuthSchema), googleAuth);
router.post("/logout", logout);

// ================= GET CURRENT USER =================
router.get("/me", protect, getMe);

// ================= STUDENT LINK CODE =================
router.post(
  "/students/link-code",
  protect,
  authorize("student"),
  generateStudentLinkCode
);

export default router;

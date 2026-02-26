import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { generateUniqueTeacherJoinCode } from "../utils/teacherJoinCode.js";

const googleClient = new OAuth2Client();
const selfRegisterRoles = new Set(["student", "teacher", "parent"]);
const googleAutoRegisterRole = "student";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "XSRF-TOKEN";
const AUTH_COOKIE_NAME = "token";
const JWT_EXPIRES_IN = process.env.JWT_EXP || "7d";
const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const ensureJwtSecret = (res) => {
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ msg: "Server configuration error" });
    return false;
  }
  return true;
};

const createAuthToken = (user) =>
  jwt.sign(
    {
      _id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const mapAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  teacherJoinCode: user.teacherJoinCode || null,
});

const hashPassword = async (value) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(value, salt);
};

const parseJwtExpiryToMs = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
    return null;
  }

  const match = raw.match(/^(\d+)\s*([smhdw])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount < 1) return null;

  const unitMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return amount * unitMs[unit];
};

const getCookieConfig = () => {
  const rawSameSite = String(process.env.COOKIE_SAME_SITE || "lax").toLowerCase();
  const sameSite = ["lax", "strict", "none"].includes(rawSameSite)
    ? rawSameSite
    : "lax";
  let secure = String(
    process.env.COOKIE_SECURE || (process.env.NODE_ENV === "production")
  ).toLowerCase() === "true";
  if (sameSite === "none") {
    secure = true;
  }
  const maxAge = parseJwtExpiryToMs(JWT_EXPIRES_IN) || DEFAULT_COOKIE_MAX_AGE_MS;
  const path = "/";
  return { sameSite, secure, maxAge, path };
};

const setAuthCookies = (res, token) => {
  const { sameSite, secure, maxAge, path } = getCookieConfig();

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge,
    path,
  });

  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    maxAge,
    path,
  });
};

const clearAuthCookies = (res) => {
  const { sameSite, secure, path } = getCookieConfig();

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path,
  });

  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure,
    sameSite,
    path,
  });
};

/* ================= REGISTER ================= */
export const register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();
    const requestedRole = String(req.body.role || "student").toLowerCase();

    if (!ensureJwtSecret(res)) return;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "Missing fields" });
    }

    if (!selfRegisterRoles.has(requestedRole)) {
      return res.status(400).json({ msg: "Invalid role selected" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashed = await hashPassword(password);

    let teacherJoinCode;
    if (requestedRole === "teacher") {
      teacherJoinCode = await generateUniqueTeacherJoinCode();
    }

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: requestedRole,
      ...(teacherJoinCode ? { teacherJoinCode } : {}),
    });

    const token = createAuthToken(user);
    setAuthCookies(res, token);

    res.json({
      token,
      user: mapAuthUser(user),
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.teacherJoinCode) {
      return res.status(400).json({
        msg: "Registration failed. Please try again.",
      });
    }

    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ================= LOGIN ================= */
export const login = async (req, res) => {
  try {
    const password = req.body.password;
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!ensureJwtSecret(res)) return;

    if (!email || !password) {
      return res.status(400).json({ msg: "Missing fields" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ msg: "Account is deactivated" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = createAuthToken(user);
    setAuthCookies(res, token);

    res.json({
      token,
      user: mapAuthUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ================= GOOGLE AUTH ================= */
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!ensureJwtSecret(res)) return;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ msg: "Server configuration error" });
    }

    if (!credential) {
      return res.status(400).json({ msg: "Missing Google credential" });
    }

    let payload;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ msg: "Google authentication failed" });
    }

    const email = String(payload?.email || "").trim().toLowerCase();
    const name = String(payload?.name || "").trim();

    if (!payload?.email_verified || !email) {
      return res.status(400).json({ msg: "Google account email is not verified" });
    }

    let user = await User.findOne({ email });

    if (user && !user.isActive) {
      return res.status(403).json({ msg: "Account is deactivated" });
    }

    if (!user) {
      const fallbackName = email.split("@")[0] || "New User";
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await hashPassword(randomPassword);

      user = new User({
        name: name || fallbackName,
        email,
        password: hashedPassword,
        role: googleAutoRegisterRole,
      });

      try {
        await user.save();
      } catch (err) {
        if (err?.code === 11000) {
          user = await User.findOne({ email });
        } else {
          throw err;
        }
      }
    }

    if (!user) {
      return res.status(500).json({ msg: "Unable to complete authentication" });
    }

    const token = createAuthToken(user);
    setAuthCookies(res, token);

    return res.json({
      token,
      user: mapAuthUser(user),
    });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

/* ================= STUDENT LINK CODE ================= */
export const generateStudentLinkCode = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ msg: "Access denied" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    user.linkCode = code;
    user.linkCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    res.json({
      code,
      expiresInMinutes: 10,
    });
  } catch (err) {
    console.error("Generate link code error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ================= GET CURRENT USER ================= */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        teacherJoinCode: user.teacherJoinCode || null,
      },
    });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
};

/* ================= LOGOUT ================= */
export const logout = async (req, res) => {
  clearAuthCookies(res);
  return res.json({ message: "Logged out" });
};

import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { generateUniqueTeacherJoinCode } from "../utils/teacherJoinCode.js";

const googleClient = new OAuth2Client();
const selfRegisterRoles = new Set(["student", "teacher", "parent"]);
const googleAutoRegisterRole = "student";

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
    { expiresIn: process.env.JWT_EXP || "7d" }
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

/* ================= REGISTER ================= */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const requestedRole = String(req.body.role || "student").toLowerCase();

    if (!ensureJwtSecret(res)) return;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "Missing fields" });
    }

    if (!selfRegisterRoles.has(requestedRole)) {
      return res.status(400).json({ msg: "Invalid role selected" });
    }

    let user = await User.findOne({ email });
    if (user) {
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

    await user.save();

    const token = createAuthToken(user);

    res.json({
      token,
      user: mapAuthUser(user),
    });
  } catch (err) {
    if (err?.code === 11000) {
      if (err?.keyPattern?.teacherJoinCode) {
        return res.status(400).json({
          msg: "Registration failed. Please try again.",
        });
      }
    }

    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ================= LOGIN ================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!ensureJwtSecret(res)) return;

    if (!email || !password) {
      return res.status(400).json({ msg: "Missing fields" });
    }

    // 🔐 Explicitly select password because schema hides it
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

    // ✅ SEND TOKEN AS COOKIE
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

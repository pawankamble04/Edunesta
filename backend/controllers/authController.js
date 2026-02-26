import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import AuthSession from "../models/AuthSession.js";
import { generateUniqueTeacherJoinCode } from "../utils/teacherJoinCode.js";
import { writeAuditLog } from "../utils/audit.js";

const googleClient = new OAuth2Client();
const selfRegisterRoles = new Set(["student", "teacher", "parent"]);
const googleAutoRegisterRole = "student";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "XSRF-TOKEN";
const AUTH_COOKIE_NAME = "token";
const REFRESH_COOKIE_NAME = "refreshToken";
const ACCESS_JWT_EXPIRES_IN =
  process.env.ACCESS_JWT_EXP || process.env.JWT_EXP || "15m";
const DEFAULT_ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = Math.max(
  Number(process.env.MAX_LOGIN_ATTEMPTS || 5),
  1
);
const LOGIN_LOCK_MS =
  Math.max(Number(process.env.LOGIN_LOCK_MINUTES || 15), 1) * 60 * 1000;

const ensureJwtSecret = (res) => {
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ msg: "Server configuration error" });
    return false;
  }
  return true;
};

const createAccessToken = (user, sessionId) =>
  jwt.sign(
    {
      _id: user._id,
      role: user.role,
      sid: String(sessionId || ""),
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_JWT_EXPIRES_IN }
  );

const generateRefreshToken = () => crypto.randomBytes(64).toString("hex");
const hashRefreshToken = (token) =>
  crypto
    .createHash("sha256")
    .update(`${String(token || "")}:${String(process.env.JWT_SECRET || "")}`)
    .digest("hex");

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
  const path = "/";
  const accessMaxAge =
    parseJwtExpiryToMs(ACCESS_JWT_EXPIRES_IN) || DEFAULT_ACCESS_COOKIE_MAX_AGE_MS;
  const refreshTtlDays = Math.max(Number(process.env.REFRESH_TOKEN_DAYS || 30), 1);
  const refreshMaxAge = refreshTtlDays * 24 * 60 * 60 * 1000;

  return {
    sameSite,
    secure,
    path,
    accessMaxAge,
    refreshMaxAge: Number.isFinite(refreshMaxAge)
      ? refreshMaxAge
      : DEFAULT_REFRESH_COOKIE_MAX_AGE_MS,
  };
};

const getSessionClientMeta = (req) => {
  const userAgent = String(req.get("user-agent") || "").trim().slice(0, 400);
  const ipAddress = String(req.ip || req.connection?.remoteAddress || "unknown")
    .trim()
    .slice(0, 120);
  return { userAgent, ipAddress };
};

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const { sameSite, secure, path, accessMaxAge, refreshMaxAge } = getCookieConfig();

  res.cookie(AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: accessMaxAge,
    path,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: refreshMaxAge,
    path,
  });

  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    maxAge: refreshMaxAge,
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

  res.clearCookie(REFRESH_COOKIE_NAME, {
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

const getRefreshTokenFromRequest = (req) =>
  String(req.cookies?.[REFRESH_COOKIE_NAME] || "").trim();

const getRefreshExpiresAt = () => {
  const { refreshMaxAge } = getCookieConfig();
  return new Date(Date.now() + refreshMaxAge);
};

const clearLoginSecurityFlags = async (user) => {
  const shouldReset =
    Number(user.failedLoginAttempts || 0) > 0 ||
    Boolean(user.loginLockUntil) ||
    Boolean(user.lastFailedLoginAt);
  if (!shouldReset) return;

  user.failedLoginAttempts = 0;
  user.loginLockUntil = null;
  user.lastFailedLoginAt = null;
  await user.save();
};

const applyFailedLoginAttempt = async (user) => {
  const now = Date.now();
  const nextAttempts = Number(user.failedLoginAttempts || 0) + 1;

  if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
    user.failedLoginAttempts = 0;
    user.loginLockUntil = new Date(now + LOGIN_LOCK_MS);
  } else {
    user.failedLoginAttempts = nextAttempts;
  }

  user.lastFailedLoginAt = new Date(now);
  await user.save();

  return {
    locked: Boolean(user.loginLockUntil && user.loginLockUntil.getTime() > now),
    retryAfterSeconds: user.loginLockUntil
      ? Math.max(Math.ceil((user.loginLockUntil.getTime() - now) / 1000), 1)
      : 0,
    attemptsRemaining: Math.max(MAX_LOGIN_ATTEMPTS - nextAttempts, 0),
  };
};

const createAuthSessionBundle = async ({ user, req }) => {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const { userAgent, ipAddress } = getSessionClientMeta(req);

  const session = await AuthSession.create({
    user: user._id,
    refreshTokenHash,
    userAgent,
    ipAddress,
    lastUsedAt: new Date(),
    expiresAt: getRefreshExpiresAt(),
  });

  const accessToken = createAccessToken(user, session._id);
  return { session, accessToken, refreshToken };
};

const sendAuthSuccess = async ({ res, user, req, action, meta = {} }) => {
  const { session, accessToken, refreshToken } = await createAuthSessionBundle({
    user,
    req,
  });
  setAuthCookies(res, { accessToken, refreshToken });

  await writeAuditLog({
    action,
    actor: user,
    target: "auth_session",
    targetId: session._id,
    meta,
  });

  return res.json({
    token: accessToken,
    user: mapAuthUser(user),
    sessionId: session._id,
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

    const createdUser = await User.create({
      name,
      email,
      password: hashed,
      role: requestedRole,
      ...(teacherJoinCode ? { teacherJoinCode } : {}),
    });

    const user = await User.findById(createdUser._id);
    if (!user) {
      return res.status(500).json({ msg: "Server error" });
    }

    return sendAuthSuccess({
      res,
      user,
      req,
      action: "auth.register.success",
      meta: { method: "password", role: requestedRole },
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
    const now = Date.now();

    if (!ensureJwtSecret(res)) return;

    if (!email || !password) {
      return res.status(400).json({ msg: "Missing fields" });
    }

    const user = await User.findOne({ email }).select(
      "+password failedLoginAttempts loginLockUntil lastFailedLoginAt lastLoginAt"
    );
    if (!user) {
      await writeAuditLog({
        action: "auth.login.failed",
        target: "user",
        meta: {
          method: "password",
          reason: "user_not_found",
          email,
          ipAddress: getSessionClientMeta(req).ipAddress,
        },
      });
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    if (!user.isActive) {
      await writeAuditLog({
        action: "auth.login.failed",
        actor: user,
        target: "user",
        targetId: user._id,
        meta: { method: "password", reason: "inactive_user" },
      });
      return res.status(403).json({ msg: "Account is deactivated" });
    }

    if (user.loginLockUntil && user.loginLockUntil.getTime() > now) {
      const retryAfter = Math.max(
        Math.ceil((user.loginLockUntil.getTime() - now) / 1000),
        1
      );
      res.setHeader("Retry-After", String(retryAfter));
      await writeAuditLog({
        action: "auth.login.blocked",
        actor: user,
        target: "user",
        targetId: user._id,
        meta: { method: "password", retryAfterSeconds: retryAfter },
      });
      return res.status(429).json({
        msg: "Too many failed login attempts. Try again later.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const failed = await applyFailedLoginAttempt(user);
      await writeAuditLog({
        action: "auth.login.failed",
        actor: user,
        target: "user",
        targetId: user._id,
        meta: {
          method: "password",
          reason: failed.locked ? "locked_after_failures" : "invalid_password",
          retryAfterSeconds: failed.retryAfterSeconds || 0,
          attemptsRemaining: failed.attemptsRemaining,
        },
      });
      if (failed.locked) {
        res.setHeader("Retry-After", String(failed.retryAfterSeconds));
        return res.status(429).json({
          msg: "Too many failed login attempts. Try again later.",
        });
      }
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    await clearLoginSecurityFlags(user);
    user.lastLoginAt = new Date();
    await user.save();

    return sendAuthSuccess({
      res,
      user,
      req,
      action: "auth.login.success",
      meta: { method: "password" },
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
      await writeAuditLog({
        action: "auth.login.failed",
        actor: user,
        target: "user",
        targetId: user._id,
        meta: { method: "google", reason: "inactive_user" },
      });
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

    await clearLoginSecurityFlags(user);
    user.lastLoginAt = new Date();
    await user.save();

    return sendAuthSuccess({
      res,
      user,
      req,
      action: "auth.login.success",
      meta: { method: "google" },
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

/* ================= REFRESH ACCESS TOKEN ================= */
export const refreshAccessToken = async (req, res) => {
  try {
    if (!ensureJwtSecret(res)) return;

    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Refresh token missing" });
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await AuthSession.findOne({
      refreshTokenHash,
      revokedAt: null,
    }).populate("user", "name email role teacherJoinCode isActive");

    if (!session || !session.user || !session.user.isActive) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid session" });
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      session.revokedAt = new Date();
      session.revokedReason = "expired";
      await session.save();
      clearAuthCookies(res);
      return res.status(401).json({ message: "Session expired" });
    }

    const nextRefreshToken = generateRefreshToken();
    session.refreshTokenHash = hashRefreshToken(nextRefreshToken);
    session.lastUsedAt = new Date();
    const { userAgent, ipAddress } = getSessionClientMeta(req);
    session.userAgent = userAgent;
    session.ipAddress = ipAddress;
    session.expiresAt = getRefreshExpiresAt();
    await session.save();

    const accessToken = createAccessToken(session.user, session._id);
    setAuthCookies(res, { accessToken, refreshToken: nextRefreshToken });

    await writeAuditLog({
      action: "auth.refresh.success",
      actor: session.user,
      target: "auth_session",
      targetId: session._id,
      meta: { method: "refresh_cookie" },
    });

    return res.json({
      token: accessToken,
      user: mapAuthUser(session.user),
      sessionId: session._id,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    clearAuthCookies(res);
    return res.status(500).json({ message: "Server error" });
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

/* ================= LIST ACTIVE SESSIONS ================= */
export const listAuthSessions = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const now = new Date();
    const rows = await AuthSession.find({
      user: userId,
      revokedAt: null,
      expiresAt: { $gt: now },
    })
      .sort({ lastUsedAt: -1, createdAt: -1 })
      .limit(40)
      .lean();

    const currentSessionId = String(req.authSessionId || "");
    return res.json({
      sessions: rows.map((row) => ({
        id: row._id,
        userAgent: row.userAgent || "",
        ipAddress: row.ipAddress || "",
        createdAt: row.createdAt || null,
        lastUsedAt: row.lastUsedAt || null,
        expiresAt: row.expiresAt || null,
        isCurrent: String(row._id) === currentSessionId,
      })),
    });
  } catch (err) {
    console.error("List auth sessions error:", err);
    return res.status(500).json({ message: "Failed to load sessions" });
  }
};

/* ================= REVOKE ONE SESSION ================= */
export const revokeAuthSession = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const session = await AuthSession.findOne({
      _id: id,
      user: userId,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!session.revokedAt) {
      session.revokedAt = new Date();
      session.revokedReason = "manual_revoke";
      await session.save();
    }

    const isCurrent = String(req.authSessionId || "") === String(session._id);
    if (isCurrent) {
      clearAuthCookies(res);
    }

    await writeAuditLog({
      action: "auth.session.revoked",
      actor: req.user,
      target: "auth_session",
      targetId: session._id,
      meta: { isCurrent },
    });

    return res.json({
      message: isCurrent
        ? "Current session revoked. Please login again."
        : "Session revoked",
      isCurrent,
    });
  } catch (err) {
    console.error("Revoke auth session error:", err);
    return res.status(500).json({ message: "Failed to revoke session" });
  }
};

/* ================= LOGOUT ALL SESSIONS ================= */
export const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const now = new Date();
    const result = await AuthSession.updateMany(
      {
        user: userId,
        revokedAt: null,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          revokedAt: now,
          revokedReason: "logout_all",
        },
      }
    );

    clearAuthCookies(res);
    await writeAuditLog({
      action: "auth.logout_all",
      actor: req.user,
      target: "auth_session",
      meta: { revokedSessions: Number(result.modifiedCount || 0) },
    });

    return res.json({
      message: "Logged out from all devices",
      revokedSessions: Number(result.modifiedCount || 0),
    });
  } catch (err) {
    console.error("Logout all sessions error:", err);
    return res.status(500).json({ message: "Failed to logout from all sessions" });
  }
};

/* ================= LOGOUT ================= */
export const logout = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    let revokedSessionId = null;

    if (refreshToken && process.env.JWT_SECRET) {
      const refreshTokenHash = hashRefreshToken(refreshToken);
      const session = await AuthSession.findOne({
        refreshTokenHash,
        revokedAt: null,
      }).select("_id");

      if (session?._id) {
        revokedSessionId = session._id;
        await AuthSession.updateOne(
          { _id: session._id },
          {
            $set: {
              revokedAt: new Date(),
              revokedReason: "logout",
            },
          }
        );
      }
    }

    clearAuthCookies(res);
    await writeAuditLog({
      action: "auth.logout",
      actor: req.user,
      target: "auth_session",
      targetId: revokedSessionId || undefined,
      meta: { revokedSession: Boolean(revokedSessionId) },
    });

    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    clearAuthCookies(res);
    return res.json({ message: "Logged out" });
  }
};

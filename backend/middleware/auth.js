import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import AuthSession from "../models/AuthSession.js";

const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const getTokenFromRequest = (req) => {
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return {
        token,
        source: "header",
      };
    }
  }

  const cookieToken = String(req.cookies?.token || "").trim();
  if (cookieToken) {
    return {
      token: cookieToken,
      source: "cookie",
    };
  }

  return {
    token: null,
    source: null,
  };
};

const touchSessionUsage = async (session) => {
  if (!session?._id) return;

  const lastUsed = session.lastUsedAt ? new Date(session.lastUsedAt).getTime() : 0;
  if (Date.now() - lastUsed < SESSION_TOUCH_INTERVAL_MS) return;

  try {
    await AuthSession.updateOne(
      { _id: session._id },
      { $set: { lastUsedAt: new Date() } }
    );
  } catch {
    // Non-blocking best effort update.
  }
};

const auth = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server configuration error",
      });
    }

    const { token, source } = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        message: "Not authorized, no token",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded._id) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    let session = null;
    const sessionId = String(decoded.sid || "").trim();
    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(401).json({
          message: "Not authorized, session invalid",
        });
      }

      session = await AuthSession.findOne({
        _id: sessionId,
        user: decoded._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).select("_id lastUsedAt");

      if (!session) {
        return res.status(401).json({
          message: "Not authorized, session expired",
        });
      }
    }

    const user = await User.findById(decoded._id).select(
      "name email role isActive"
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Not authorized, user inactive or missing",
      });
    }

    req.user = {
      _id: user._id,
      id: user._id,
      role: typeof user.role === "string" ? user.role.toLowerCase() : null,
      name: user.name,
      email: user.email,
    };
    req.authSource = source;
    req.authSessionId = session?._id || null;

    void touchSessionUsage(session);
    return next();
  } catch {
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }
};

export default auth;
export const protect = auth;

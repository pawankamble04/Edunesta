import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

    return next();
  } catch {
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }
};

export default auth;
export const protect = auth;

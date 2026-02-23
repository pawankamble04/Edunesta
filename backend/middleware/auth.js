import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server configuration error",
      });
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({
        message: "Not authorized, no token",
      });
    }

    const token = authHeader.split(" ")[1];

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

    // 🔥 Normalize role safely
    decoded.role = typeof decoded.role === "string"
      ? decoded.role.toLowerCase()
      : null;

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
      role: typeof user.role === "string" ? user.role.toLowerCase() : null,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }
};

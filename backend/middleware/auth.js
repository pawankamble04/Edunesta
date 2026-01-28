import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  try {
    // ✅ READ TOKEN FROM COOKIE
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        message: "Not authorized, no token",
      });
    }

    // ✅ VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ ATTACH USER TO REQUEST
    req.user = {
      id: decoded.id,
      role: decoded.role?.toLowerCase(),
      email: decoded.email || null,
    };

    // ✅ ROLE VALIDATION
    const allowedRoles = ["admin", "teacher", "student", "parent"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  } catch (error) {
    console.error("JWT ERROR:", error.message);
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }
};

export default auth;
export const protect = auth;

// Role-based access control middleware

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!req.user.role || typeof req.user.role !== "string") {
      return res.status(403).json({
        message: "Invalid role",
      });
    }

    // 🔥 Normalize roles for safe comparison
    const userRole = req.user.role.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map((r) =>
      r.toLowerCase()
    );

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: "Access denied: insufficient permissions",
      });
    }

    next();
  };
};

export default authorize;
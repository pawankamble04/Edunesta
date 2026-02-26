import crypto from "crypto";

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "XSRF-TOKEN";
const CSRF_HEADER_NAME = String(
  process.env.CSRF_HEADER_NAME || "X-CSRF-Token"
).toLowerCase();
const CSRF_ENABLED =
  String(process.env.CSRF_ENABLED || "true").toLowerCase() !== "false";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/google",
]);

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
  return { sameSite, secure };
};

const getRequestPath = (req) => String(req.originalUrl || req.url || "").split("?")[0];

export const ensureCsrfCookie = (req, res, next) => {
  if (!CSRF_ENABLED) return next();
  if (!req.cookies?.token) return next();

  if (!req.cookies[CSRF_COOKIE_NAME]) {
    const { sameSite, secure } = getCookieConfig();
    const csrfToken = crypto.randomBytes(24).toString("hex");
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      sameSite,
      secure,
      path: "/",
    });
  }

  return next();
};

export const csrfProtection = (req, res, next) => {
  if (!CSRF_ENABLED) return next();
  if (SAFE_METHODS.has(req.method)) return next();

  const path = getRequestPath(req);
  if (CSRF_EXEMPT_PATHS.has(path)) return next();

  if (!req.cookies?.token) return next();

  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: "CSRF token invalid or missing" });
  }

  return next();
};

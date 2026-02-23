const buckets = new Map();
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_BUCKETS = Number(process.env.RATE_LIMIT_MAX_BUCKETS || 50000);
let lastCleanupAt = 0;

const getClientIdentity = (req) => {
  if (req.user?._id || req.user?.id) {
    return `user:${String(req.user._id || req.user.id)}`;
  }
  return `ip:${req.ip || req.connection?.remoteAddress || "unknown"}`;
};

const cleanupBuckets = (now) => {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  for (const [key, bucket] of buckets.entries()) {
    if (!bucket || bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (!Number.isFinite(MAX_BUCKETS) || MAX_BUCKETS <= 0) return;

  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
};

export const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  keyPrefix = "global",
  message = "Too many requests. Please try again later.",
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    cleanupBuckets(now);

    const identity = getClientIdentity(req);
    const key = `${keyPrefix}:${identity}`;

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (current.count >= max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfter, 1)));
      return res.status(429).json({ message });
    }

    current.count += 1;
    // LRU-style refresh to keep active identities from being evicted first.
    buckets.delete(key);
    buckets.set(key, current);
    return next();
  };
};

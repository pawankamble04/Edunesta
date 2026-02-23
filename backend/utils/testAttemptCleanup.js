import TestAttempt from "../models/TestAttempt.js";

const DEFAULT_GRACE_HOURS = 24;
const DEFAULT_INTERVAL_MINUTES = 60;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const toOptionalPositiveInt = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

export const cleanupStaleTestAttempts = async ({
  graceHours = DEFAULT_GRACE_HOURS,
  limit = null,
} = {}) => {
  const safeGraceHours = toPositiveInt(graceHours, DEFAULT_GRACE_HOURS);
  const safeLimit = toOptionalPositiveInt(limit);

  const cutoffAt = new Date(Date.now() - safeGraceHours * 60 * 60 * 1000);
  const query = {
    isSubmitted: false,
    expiresAt: { $lte: cutoffAt },
  };

  let deletedCount = 0;

  if (safeLimit) {
    const staleIds = await TestAttempt.find(query)
      .sort({ expiresAt: 1 })
      .select("_id")
      .limit(safeLimit)
      .lean();

    if (staleIds.length > 0) {
      const result = await TestAttempt.deleteMany({
        _id: { $in: staleIds.map((doc) => doc._id) },
      });
      deletedCount = Number(result?.deletedCount || 0);
    }
  } else {
    const result = await TestAttempt.deleteMany(query);
    deletedCount = Number(result?.deletedCount || 0);
  }

  return {
    deletedCount,
    graceHours: safeGraceHours,
    limit: safeLimit,
    cutoffAt: cutoffAt.toISOString(),
  };
};

const toOptionalBoolean = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
};

export const startStaleTestAttemptCleanupScheduler = () => {
  const envFlag = toOptionalBoolean(process.env.TEST_ATTEMPT_AUTO_CLEAN_ENABLED);
  const enabled = envFlag ?? process.env.NODE_ENV === "production";

  if (!enabled) {
    console.log("[test-attempt-cleanup] scheduler disabled");
    return null;
  }

  const intervalMinutes = toPositiveInt(
    process.env.TEST_ATTEMPT_AUTO_CLEAN_INTERVAL_MINUTES,
    DEFAULT_INTERVAL_MINUTES
  );
  const graceHours = toPositiveInt(
    process.env.TEST_ATTEMPT_CLEANUP_GRACE_HOURS,
    DEFAULT_GRACE_HOURS
  );
  const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;

  const runCleanup = async (source) => {
    try {
      const result = await cleanupStaleTestAttempts({ graceHours });
      console.log(
        `[test-attempt-cleanup] ${source}: deleted=${result.deletedCount}, graceHours=${result.graceHours}, cutoffAt=${result.cutoffAt}`
      );
    } catch (error) {
      console.error(`[test-attempt-cleanup] ${source} failed:`, error.message);
    }
  };

  // Run once immediately on server startup.
  void runCleanup("startup");

  const timer = setInterval(() => {
    void runCleanup("interval");
  }, intervalMs);

  // Do not keep process alive only for cleanup timer.
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  console.log(
    `[test-attempt-cleanup] scheduler enabled: every ${Math.max(intervalMinutes, 1)} minute(s), graceHours=${graceHours}`
  );

  return timer;
};

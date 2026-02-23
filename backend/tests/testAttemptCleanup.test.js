import test from "node:test";
import assert from "node:assert/strict";
import TestAttempt from "../models/TestAttempt.js";
import {
  cleanupStaleTestAttempts,
  startStaleTestAttemptCleanupScheduler,
} from "../utils/testAttemptCleanup.js";

test(
  "test attempt cleanup: deletes all stale attempts when no limit is provided",
  { concurrency: false },
  async () => {
    const originalDeleteMany = TestAttempt.deleteMany;

    let receivedQuery = null;

    try {
      TestAttempt.deleteMany = async (query) => {
        receivedQuery = query;
        return { deletedCount: 3 };
      };

      const result = await cleanupStaleTestAttempts({ graceHours: 24 });

      assert.equal(result.deletedCount, 3);
      assert.equal(result.graceHours, 24);
      assert.equal(result.limit, null);
      assert.equal(receivedQuery?.isSubmitted, false);
      assert.equal(receivedQuery?.expiresAt?.$lte instanceof Date, true);
    } finally {
      TestAttempt.deleteMany = originalDeleteMany;
    }
  }
);

test(
  "test attempt cleanup: respects limit and deletes selected stale ids",
  { concurrency: false },
  async () => {
    const originalFind = TestAttempt.find;
    const originalDeleteMany = TestAttempt.deleteMany;

    let findQuery = null;
    let findLimit = null;
    let deleteQuery = null;

    try {
      TestAttempt.find = (query) => {
        findQuery = query;
        return {
          sort() {
            return this;
          },
          select() {
            return this;
          },
          limit(value) {
            findLimit = value;
            return this;
          },
          async lean() {
            return [{ _id: "attempt-1" }, { _id: "attempt-2" }];
          },
        };
      };

      TestAttempt.deleteMany = async (query) => {
        deleteQuery = query;
        return { deletedCount: 2 };
      };

      const result = await cleanupStaleTestAttempts({
        graceHours: 48,
        limit: 2,
      });

      assert.equal(result.deletedCount, 2);
      assert.equal(result.graceHours, 48);
      assert.equal(result.limit, 2);
      assert.equal(findQuery?.isSubmitted, false);
      assert.equal(findQuery?.expiresAt?.$lte instanceof Date, true);
      assert.equal(findLimit, 2);
      assert.deepEqual(deleteQuery, {
        _id: { $in: ["attempt-1", "attempt-2"] },
      });
    } finally {
      TestAttempt.find = originalFind;
      TestAttempt.deleteMany = originalDeleteMany;
    }
  }
);

test(
  "test attempt cleanup scheduler: enables by default in production when env flag is missing",
  { concurrency: false },
  async () => {
    const originalDeleteMany = TestAttempt.deleteMany;
    const originalSetInterval = global.setInterval;
    const originalEnvNode = process.env.NODE_ENV;
    const originalEnvFlag = process.env.TEST_ATTEMPT_AUTO_CLEAN_ENABLED;

    let intervalRegistered = false;

    try {
      TestAttempt.deleteMany = async () => ({ deletedCount: 0 });
      process.env.NODE_ENV = "production";
      delete process.env.TEST_ATTEMPT_AUTO_CLEAN_ENABLED;

      global.setInterval = () => {
        intervalRegistered = true;
        return {
          unref() {},
        };
      };

      const timer = startStaleTestAttemptCleanupScheduler();
      assert.equal(intervalRegistered, true);
      assert.notEqual(timer, null);
    } finally {
      TestAttempt.deleteMany = originalDeleteMany;
      global.setInterval = originalSetInterval;
      process.env.NODE_ENV = originalEnvNode;
      if (originalEnvFlag === undefined) {
        delete process.env.TEST_ATTEMPT_AUTO_CLEAN_ENABLED;
      } else {
        process.env.TEST_ATTEMPT_AUTO_CLEAN_ENABLED = originalEnvFlag;
      }
    }
  }
);

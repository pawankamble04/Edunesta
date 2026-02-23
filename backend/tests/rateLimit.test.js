import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../middleware/rateLimit.js";

const createRes = () => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
  };

  res.setHeader = (key, value) => {
    res.headers[key] = value;
  };

  res.status = (code) => {
    res.statusCode = code;
    return {
      json(payload) {
        res.body = payload;
        return res;
      },
    };
  };

  return res;
};

test("rate limiter blocks after max requests", () => {
  const limiter = createRateLimiter({
    windowMs: 10_000,
    max: 1,
    keyPrefix: "test-block",
  });

  const req = { ip: "10.0.0.1" };

  let nextCalled = false;
  let res = createRes();
  limiter(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);

  nextCalled = false;
  res = createRes();
  limiter(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body?.message, "Too many requests. Please try again later.");
  assert.ok(Number(res.headers["Retry-After"]) >= 1);
});

test("rate limiter keys authenticated users separately from same IP", () => {
  const limiter = createRateLimiter({
    windowMs: 10_000,
    max: 1,
    keyPrefix: "test-user-key",
  });

  const reqA = { ip: "10.0.0.2", user: { _id: "user-a" } };
  const reqB = { ip: "10.0.0.2", user: { _id: "user-b" } };

  let nextA = false;
  let nextB = false;

  limiter(reqA, createRes(), () => {
    nextA = true;
  });
  limiter(reqB, createRes(), () => {
    nextB = true;
  });

  assert.equal(nextA, true);
  assert.equal(nextB, true);
});

test("rate limiter ignores spoofed x-forwarded-for header", () => {
  const limiter = createRateLimiter({
    windowMs: 10_000,
    max: 1,
    keyPrefix: "test-forwarded",
  });

  const req1 = {
    ip: "10.0.0.3",
    headers: { "x-forwarded-for": "1.1.1.1" },
  };
  const req2 = {
    ip: "10.0.0.3",
    headers: { "x-forwarded-for": "2.2.2.2" },
  };

  limiter(req1, createRes(), () => {});

  let nextCalled = false;
  const res = createRes();
  limiter(req2, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
});

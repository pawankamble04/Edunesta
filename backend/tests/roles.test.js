import test from "node:test";
import assert from "node:assert/strict";
import authorize from "../middleware/roles.js";

const createRes = () => {
  const res = {
    statusCode: null,
    body: null,
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

test("authorize returns 401 when req.user is missing", () => {
  const middleware = authorize("admin");
  const req = {};
  const res = createRes();
  let called = false;

  middleware(req, res, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: "Not authenticated" });
});

test("authorize allows case-insensitive role match", () => {
  const middleware = authorize("admin");
  const req = { user: { role: "ADMIN" } };
  const res = createRes();
  let called = false;

  middleware(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(res.statusCode, null);
});

test("authorize blocks insufficient permissions", () => {
  const middleware = authorize("teacher");
  const req = { user: { role: "student" } };
  const res = createRes();
  let called = false;

  middleware(req, res, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    message: "Access denied: insufficient permissions",
  });
});

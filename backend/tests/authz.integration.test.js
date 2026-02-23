import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import authorize from "../middleware/roles.js";
import { errorContract } from "../middleware/errorContract.js";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(errorContract);

  app.use((req, res, next) => {
    const role = req.headers["x-test-role"];
    if (typeof role === "string" && role.trim()) {
      req.user = { role };
    }
    next();
  });

  app.get("/admin/users", authorize("admin"), (req, res) =>
    res.json({ ok: true })
  );
  app.get("/teacher/dashboard", authorize("teacher"), (req, res) =>
    res.json({ ok: true })
  );
  app.post("/submissions/submit", authorize("student"), (req, res) =>
    res.json({ ok: true })
  );

  return app;
};

test("authz: missing user is rejected with normalized 401 error", async () => {
  const app = buildApp();
  const res = await request(app).get("/admin/users");

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
  assert.equal(res.body.message, "Not authenticated");
});

test("authz: insufficient role is rejected with normalized 403 error", async () => {
  const app = buildApp();
  const res = await request(app)
    .get("/admin/users")
    .set("x-test-role", "teacher");

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "FORBIDDEN");
  assert.equal(res.body.message, "Access denied: insufficient permissions");
});

test("authz: role comparison is case-insensitive in integration flow", async () => {
  const app = buildApp();
  const res = await request(app)
    .get("/admin/users")
    .set("x-test-role", "ADMIN");

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("authz: teacher-only route blocks student role", async () => {
  const app = buildApp();
  const res = await request(app)
    .get("/teacher/dashboard")
    .set("x-test-role", "student");

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});

test("authz: student-only route blocks parent role", async () => {
  const app = buildApp();
  const res = await request(app)
    .post("/submissions/submit")
    .set("x-test-role", "parent")
    .send({});

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});

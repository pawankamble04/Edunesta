import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { validate } from "../middleware/validate.js";
import { errorContract } from "../middleware/errorContract.js";
import {
  googleAuthSchema,
  objectIdParamSchema,
  registerSchema,
} from "../validation/schemas.js";

const buildValidationApp = () => {
  const app = express();
  app.use(express.json());
  app.use(errorContract);

  app.post("/auth/register", validate(registerSchema), (req, res) => {
    return res.json({
      accepted: true,
      body: req.body,
    });
  });

  app.post("/auth/google", validate(googleAuthSchema), (req, res) => {
    return res.json({
      accepted: true,
      body: req.body,
    });
  });

  app.get("/tests/:id", validate(objectIdParamSchema("id")), (req, res) => {
    return res.json({
      accepted: true,
      id: req.params.id,
    });
  });

  return app;
};

test("validation: invalid register payload returns normalized validation error", async () => {
  const app = buildValidationApp();
  const res = await request(app).post("/auth/register").send({
    name: "A",
    email: "not-an-email",
    password: "123",
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.equal(Array.isArray(res.body.error.details), true);
  assert.equal(res.body.message, "Validation failed");
});

test("validation: valid register payload passes through parsed body", async () => {
  const app = buildValidationApp();
  const res = await request(app).post("/auth/register").send({
    name: "Teacher One",
    email: "teacher.one@example.com",
    password: "StrongPass123",
    role: "teacher",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.accepted, true);
  assert.equal(res.body.body.email, "teacher.one@example.com");
  assert.equal(res.body.body.role, "teacher");
});

test("validation: invalid google auth payload returns normalized validation error", async () => {
  const app = buildValidationApp();
  const res = await request(app).post("/auth/google").send({
    credential: "",
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.equal(res.body.message, "Validation failed");
});

test("validation: valid google auth payload passes through parsed body", async () => {
  const app = buildValidationApp();
  const res = await request(app).post("/auth/google").send({
    credential: "mock-google-id-token",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.accepted, true);
  assert.equal(res.body.body.credential, "mock-google-id-token");
});

test("validation: invalid object id param returns normalized validation error", async () => {
  const app = buildValidationApp();
  const res = await request(app).get("/tests/not-valid-id");

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.equal(res.body.message, "Validation failed");
});

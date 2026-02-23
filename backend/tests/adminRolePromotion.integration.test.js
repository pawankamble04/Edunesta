import test from "node:test";
import assert from "node:assert/strict";
import { changeUserRole } from "../controllers/adminController.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

const TARGET_USER_ID = "507f1f77bcf86cd799439021";
const ACTOR_ADMIN_ID = "507f1f77bcf86cd799439099";

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null,
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.body = payload;
    return res;
  };

  return res;
};

test(
  "admin role change: promotes to teacher and auto-generates teacherJoinCode when missing",
  { concurrency: false },
  async () => {
    const originalFindById = User.findById;
    const originalExists = User.exists;
    const originalAuditCreate = AuditLog.create;

    let saveCalled = false;
    const doc = {
      _id: TARGET_USER_ID,
      email: "new.teacher@example.com",
      role: "student",
      teacherJoinCode: null,
      async save() {
        saveCalled = true;
      },
    };

    try {
      User.findById = () => ({
        select: async () => doc,
      });
      User.exists = async () => false;
      AuditLog.create = async () => ({ _id: "log1" });

      const req = {
        params: { id: TARGET_USER_ID },
        body: { role: "teacher" },
        user: {
          _id: ACTOR_ADMIN_ID,
          role: "admin",
          name: "Admin",
          email: "admin@example.com",
        },
      };
      const res = createRes();

      await changeUserRole(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(saveCalled, true);
      assert.equal(doc.role, "teacher");
      assert.equal(typeof doc.teacherJoinCode, "string");
      assert.equal(doc.teacherJoinCode.startsWith("TCH-"), true);
      assert.equal(doc.teacherJoinCode.length, 10);
    } finally {
      User.findById = originalFindById;
      User.exists = originalExists;
      AuditLog.create = originalAuditCreate;
    }
  }
);

test(
  "admin role change: preserves existing teacherJoinCode when already present",
  { concurrency: false },
  async () => {
    const originalFindById = User.findById;
    const originalExists = User.exists;
    const originalAuditCreate = AuditLog.create;

    let saveCalled = false;
    let existsCalled = false;
    const existingCode = "TCH-ABC123";

    const doc = {
      _id: TARGET_USER_ID,
      email: "teacher.existing@example.com",
      role: "parent",
      teacherJoinCode: existingCode,
      async save() {
        saveCalled = true;
      },
    };

    try {
      User.findById = () => ({
        select: async () => doc,
      });
      User.exists = async () => {
        existsCalled = true;
        return false;
      };
      AuditLog.create = async () => ({ _id: "log2" });

      const req = {
        params: { id: TARGET_USER_ID },
        body: { role: "teacher" },
        user: {
          _id: ACTOR_ADMIN_ID,
          role: "admin",
          name: "Admin",
          email: "admin@example.com",
        },
      };
      const res = createRes();

      await changeUserRole(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(saveCalled, true);
      assert.equal(existsCalled, false);
      assert.equal(doc.teacherJoinCode, existingCode);
    } finally {
      User.findById = originalFindById;
      User.exists = originalExists;
      AuditLog.create = originalAuditCreate;
    }
  }
);

import test from "node:test";
import assert from "node:assert/strict";
import { submitTest } from "../controllers/submissionController.js";
import Test from "../models/Test.js";
import Enrollment from "../models/Enrollment.js";
import Submission from "../models/Submission.js";
import TestAttempt from "../models/TestAttempt.js";

const VALID_TEST_ID = "507f1f77bcf86cd799439011";
const VALID_STUDENT_ID = "507f1f77bcf86cd799439012";
const VALID_TEACHER_ID = "507f1f77bcf86cd799439013";

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
  "submission timing: rejects submit when attempt session is missing",
  { concurrency: false },
  async () => {
    const originalFindById = Test.findById;
    const originalEnrollmentFind = Enrollment.find;
    const originalSubmissionFindOne = Submission.findOne;
    const originalAttemptFindOne = TestAttempt.findOne;

    try {
      Test.findById = async () => ({
        _id: VALID_TEST_ID,
        isPublished: true,
        createdBy: VALID_TEACHER_ID,
        subject: "math",
      });
      Enrollment.find = async () => [{ subject: "math" }];
      Submission.findOne = async () => null;
      TestAttempt.findOne = async () => null;

      const req = {
        body: {
          testId: VALID_TEST_ID,
          answers: [],
        },
        user: {
          _id: VALID_STUDENT_ID,
        },
      };
      const res = createRes();

      await submitTest(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(
        res.body?.message,
        "Attempt session not found. Open the test and try again."
      );
    } finally {
      Test.findById = originalFindById;
      Enrollment.find = originalEnrollmentFind;
      Submission.findOne = originalSubmissionFindOne;
      TestAttempt.findOne = originalAttemptFindOne;
    }
  }
);

test(
  "submission timing: rejects submit when attempt has expired",
  { concurrency: false },
  async () => {
    const originalFindById = Test.findById;
    const originalEnrollmentFind = Enrollment.find;
    const originalSubmissionFindOne = Submission.findOne;
    const originalAttemptFindOne = TestAttempt.findOne;

    try {
      Test.findById = async () => ({
        _id: VALID_TEST_ID,
        isPublished: true,
        createdBy: VALID_TEACHER_ID,
        subject: "math",
      });
      Enrollment.find = async () => [{ subject: "math" }];
      Submission.findOne = async () => null;
      TestAttempt.findOne = async () => ({
        isSubmitted: false,
        expiresAt: new Date(Date.now() - 5_000),
      });

      const req = {
        body: {
          testId: VALID_TEST_ID,
          answers: [],
        },
        user: {
          _id: VALID_STUDENT_ID,
        },
      };
      const res = createRes();

      await submitTest(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.message, "Test time is over");
    } finally {
      Test.findById = originalFindById;
      Enrollment.find = originalEnrollmentFind;
      Submission.findOne = originalSubmissionFindOne;
      TestAttempt.findOne = originalAttemptFindOne;
    }
  }
);

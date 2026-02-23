import test from "node:test";
import assert from "node:assert/strict";
import Submission from "../models/Submission.js";
import LectureAttendance from "../models/LectureAttendance.js";
import { getStudentDailySummary } from "../utils/dailySummary.js";

test(
  "daily summary: returns absent when no attendance and no test today",
  { concurrency: false },
  async () => {
    const originalFindOne = Submission.findOne;
    const originalAggregate = Submission.aggregate;
    const originalAttendanceExists = LectureAttendance.exists;

    try {
      Submission.findOne = () => ({
        populate: () => ({
          sort: () => ({
            select: async () => null,
          }),
        }),
      });
      Submission.aggregate = async () => [];
      LectureAttendance.exists = async () => null;

      const summary = await getStudentDailySummary("507f1f77bcf86cd799439011");

      assert.equal(summary.attendance, "Absent");
      assert.equal(summary.testMarks, null);
      assert.equal(summary.average, 0);
      assert.equal(summary.hasTestToday, false);
    } finally {
      Submission.findOne = originalFindOne;
      Submission.aggregate = originalAggregate;
      LectureAttendance.exists = originalAttendanceExists;
    }
  }
);

test(
  "daily summary: marks present and includes test marks when test submitted today",
  { concurrency: false },
  async () => {
    const originalFindOne = Submission.findOne;
    const originalAggregate = Submission.aggregate;
    const originalAttendanceExists = LectureAttendance.exists;

    try {
      Submission.findOne = () => ({
        populate: () => ({
          sort: () => ({
            select: async () => ({
              percentage: 82.4,
              score: 41,
              totalMarks: 50,
              test: { title: "Math Quiz" },
            }),
          }),
        }),
      });
      Submission.aggregate = async () => [{ avgPercentage: 74.6 }];
      LectureAttendance.exists = async () => null;

      const summary = await getStudentDailySummary("507f1f77bcf86cd799439011");

      assert.equal(summary.attendance, "Present");
      assert.equal(summary.testMarks, 82);
      assert.equal(summary.average, 75);
      assert.equal(summary.hasTestToday, true);
      assert.equal(summary.testTitle, "Math Quiz");
    } finally {
      Submission.findOne = originalFindOne;
      Submission.aggregate = originalAggregate;
      LectureAttendance.exists = originalAttendanceExists;
    }
  }
);

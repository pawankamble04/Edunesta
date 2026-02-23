import mongoose from "mongoose";
import Submission from "../models/Submission.js";
import LectureAttendance from "../models/LectureAttendance.js";

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

export const getTodayRange = (baseDate = new Date()) => {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const roundInt = (value) => Math.round(Number(value || 0));

export const getStudentDailySummary = async (studentId, baseDate = new Date()) => {
  const normalizedStudentId = toObjectId(studentId);
  if (!normalizedStudentId) {
    return {
      date: getTodayRange(baseDate).start.toISOString().slice(0, 10),
      attendance: "Absent",
      testMarks: null,
      average: 0,
      hasTestToday: false,
      testTitle: null,
    };
  }

  const { start, end } = getTodayRange(baseDate);

  const [todaySubmission, averageAggregate, todayAttendanceExists] = await Promise.all([
    Submission.findOne({
      student: normalizedStudentId,
      submittedAt: { $gte: start, $lt: end },
    })
      .populate("test", "title")
      .sort({ submittedAt: -1 })
      .select("score totalMarks percentage submittedAt test"),
    Submission.aggregate([
      { $match: { student: normalizedStudentId } },
      { $group: { _id: null, avgPercentage: { $avg: "$percentage" } } },
    ]),
    LectureAttendance.exists({
      student: normalizedStudentId,
      viewedAt: { $gte: start, $lt: end },
    }),
  ]);

  const average = roundInt(averageAggregate?.[0]?.avgPercentage || 0);
  const hasTestToday = Boolean(todaySubmission);
  const attendance = todayAttendanceExists || hasTestToday ? "Present" : "Absent";

  return {
    date: start.toISOString().slice(0, 10),
    attendance,
    testMarks: hasTestToday
      ? roundInt(
          Number.isFinite(todaySubmission.percentage)
            ? todaySubmission.percentage
            : (todaySubmission.score / Math.max(todaySubmission.totalMarks || 0, 1)) * 100
        )
      : null,
    average,
    hasTestToday,
    testTitle: hasTestToday ? todaySubmission.test?.title || null : null,
  };
};

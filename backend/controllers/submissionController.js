import mongoose from "mongoose";
import Submission from "../models/Submission.js";
import Question from "../models/Question.js";
import Test from "../models/Test.js";
import Enrollment from "../models/Enrollment.js";
import TestAttempt from "../models/TestAttempt.js";
import { normalizeSubject } from "../utils/subject.js";
import { getStudentDailySummary } from "../utils/dailySummary.js";

/* ================================
   STUDENT - SUBMIT TEST
================================ */
export const submitTest = async (req, res) => {
  try {
    const { testId, answers } = req.body;
    const studentId = req.user._id || req.user.id;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid answers format" });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    if (!test.isPublished) {
      return res.status(403).json({ message: "Test is not published" });
    }

    const enrollments = await Enrollment.find({
      student: studentId,
      teacher: test.createdBy,
    });

    const isEnrolledForSubject = enrollments.some(
      (e) => normalizeSubject(e.subject) === normalizeSubject(test.subject)
    );

    if (!isEnrolledForSubject) {
      return res.status(403).json({
        message: "You are not enrolled for this subject",
      });
    }

    const alreadySubmitted = await Submission.findOne({
      student: studentId,
      test: testId,
    });

    if (alreadySubmitted) {
      return res.status(400).json({
        message: "You have already submitted this test",
      });
    }

    const attempt = await TestAttempt.findOne({
      student: studentId,
      test: testId,
    });

    if (!attempt) {
      return res.status(400).json({
        message: "Attempt session not found. Open the test and try again.",
      });
    }

    if (attempt.isSubmitted) {
      return res.status(400).json({
        message: "You have already submitted this test",
      });
    }

    if (Date.now() > attempt.expiresAt.getTime()) {
      return res.status(400).json({
        message: "Test time is over",
      });
    }

    const questions = await Question.find({ test: testId });

    let score = 0;
    let totalMarks = 0;

    questions.forEach((q) => {
      const marks = Number(q.marks) || 0;
      totalMarks += marks;

      const ans = answers.find((a) => String(a.question) === String(q._id));
      if (ans && ans.selected === q.correctAnswer) {
        score += marks;
      }
    });

    const percentage =
      totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;

    const submission = await Submission.create({
      student: studentId,
      test: testId,
      answers,
      score,
      totalMarks,
      percentage,
      submittedAt: new Date(),
    });

    attempt.isSubmitted = true;
    attempt.submittedAt = new Date();
    await attempt.save();

    return res.json({
      message: "Test submitted successfully",
      score: submission.score,
      totalMarks: submission.totalMarks,
      percentage: submission.percentage,
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "You have already submitted this test",
      });
    }

    return res.status(500).json({
      message: "Test submission failed",
    });
  }
};

/* ================================
   TEACHER - VIEW SUBMISSIONS
================================ */
export const getSubmissionsForTest = async (req, res) => {
  try {
    const teacherId = req.user._id || req.user.id;
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    const test = await Test.findOne({
      _id: testId,
      createdBy: teacherId,
    });

    if (!test) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    const submissions = await Submission.find({ test: testId })
      .populate("student", "name email")
      .populate("test", "title")
      .sort({ submittedAt: -1 });

    return res.json(submissions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch submissions",
    });
  }
};

/* ================================
   STUDENT - VIEW OWN RESULTS
================================ */
export const getMyResults = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;

    const results = await Submission.find({ student: studentId })
      .populate("test", "title durationMinutes")
      .sort({ submittedAt: -1 });

    const formattedResults = results.map((r) => ({
      submissionId: r._id,
      testId: r.test?._id,
      testName: r.test?.title || "-",
      score: r.score ?? 0,
      totalMarks: r.totalMarks ?? 0,
      percentage: r.percentage ?? 0,
      duration: r.test?.durationMinutes ? `${r.test.durationMinutes} mins` : "-",
      submittedAt: r.submittedAt || null,
      date: r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "-",
    }));

    return res.json(formattedResults);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch results",
    });
  }
};

/* ================================
   STUDENT - DAILY STATUS (TODAY)
================================ */
export const getMyDailyStatus = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const summary = await getStudentDailySummary(studentId);
    return res.json({ summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch daily status",
    });
  }
};

/* ================================
   TEACHER - EXPORT EXCEL
================================ */
export const exportSubmissionsExcel = async (req, res) => {
  try {
    const teacherId = req.user._id || req.user.id;
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    const test = await Test.findOne({
      _id: testId,
      createdBy: teacherId,
    });

    if (!test) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    const submissions = await Submission.find({ test: testId })
      .populate("student", "name email")
      .populate("test", "title")
      .sort({ submittedAt: -1 });

    if (!submissions.length) {
      return res.status(404).json({
        message: "No submissions found",
      });
    }

    const escapeCsv = (value) => {
      const raw = String(value ?? "");
      if (/[",\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };

    const rows = [
      [
        "Student Name",
        "Email",
        "Test Name",
        "Score",
        "Total Marks",
        "Percentage",
        "Submitted At",
      ],
      ...submissions.map((s) => [
        s.student?.name || "-",
        s.student?.email || "-",
        s.test?.title || "-",
        s.score ?? 0,
        s.totalMarks ?? 0,
        `${s.percentage ?? 0}%`,
        s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "-",
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

    const safeTitle = test.title.replace(/[^a-zA-Z0-9-_]/g, "_");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=submissions-${safeTitle}.csv`
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Submission export failed",
    });
  }
};

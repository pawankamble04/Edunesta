import mongoose from "mongoose";
import Test from "../models/Test.js";
import Question from "../models/Question.js";
import Enrollment from "../models/Enrollment.js";
import Submission from "../models/Submission.js";
import TestAttempt from "../models/TestAttempt.js";
import User from "../models/User.js";
import { normalizeSubject } from "../utils/subject.js";
import { writeAuditLog } from "../utils/audit.js";

/* ===============================
   CREATE TEST (Teacher/Admin)
=============================== */
export const createTest = async (req, res) => {
  try {
    let { title, description, durationMinutes, totalMarks, subject } = req.body;

    if (!title || !durationMinutes || !totalMarks || !subject) {
      return res.status(400).json({
        message: "Title, duration, subject and total marks are required",
      });
    }

    const creatorId = req.user._id || req.user.id;

    title = title.trim();
    description = typeof description === "string" ? description.trim() : "";
    subject = normalizeSubject(subject);
    durationMinutes = Number(durationMinutes);
    totalMarks = Number(totalMarks);

    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      return res.status(400).json({
        message: "Duration must be a positive number",
      });
    }

    if (!Number.isFinite(totalMarks) || totalMarks < 1) {
      return res.status(400).json({
        message: "Total marks must be a positive number",
      });
    }

    if (req.user.role === "teacher") {
      const teacher = await User.findById(creatorId).select("subjects");
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      const canUseSubject = (teacher.subjects || []).some(
        (s) => normalizeSubject(s) === subject
      );

      if (!canUseSubject) {
        return res.status(400).json({
          message: "Test subject must be one of your configured subjects",
        });
      }
    }

    const test = await Test.create({
      title,
      description,
      subject,
      durationMinutes,
      totalMarks,
      createdBy: creatorId,
      isPublished: false,
    });

    return res.json(test);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create test" });
  }
};

/* ===============================
   GET SINGLE TEST (SECURED)
=============================== */
export const getTest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    const role = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    let test;

    if (role === "teacher") {
      test = await Test.findOne({ _id: id, createdBy: userId });
    } else if (role === "student" || role === "admin") {
      test = await Test.findById(id);
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    let attemptInfo = null;

    if (role === "student") {
      const enrollments = await Enrollment.find({
        student: userId,
        teacher: test.createdBy,
      });

      const isEnrolledForSubject = enrollments.some(
        (e) => normalizeSubject(e.subject) === normalizeSubject(test.subject)
      );

      if (!isEnrolledForSubject || !test.isPublished) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const alreadySubmitted = await Submission.exists({
        student: userId,
        test: id,
      });

      if (alreadySubmitted) {
        return res.status(400).json({
          message: "You have already submitted this test",
        });
      }

      const durationMs = Number(test.durationMinutes || 0) * 60 * 1000;
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return res.status(400).json({
          message: "Test duration is invalid",
        });
      }

      let attempt = await TestAttempt.findOne({
        student: userId,
        test: id,
      });

      if (!attempt) {
        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + durationMs);

        try {
          attempt = await TestAttempt.create({
            student: userId,
            test: id,
            startedAt,
            expiresAt,
          });
        } catch (error) {
          if (error?.code === 11000) {
            attempt = await TestAttempt.findOne({
              student: userId,
              test: id,
            });
          } else {
            throw error;
          }
        }
      }

      if (!attempt) {
        return res.status(500).json({
          message: "Failed to start attempt",
        });
      }

      if (!attempt.isSubmitted && Date.now() > attempt.expiresAt.getTime()) {
        return res.status(403).json({
          message: "Test time is over",
        });
      }

      attemptInfo = {
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds: Math.max(
          Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000),
          0
        ),
      };
    }

    let questionQuery = Question.find({ test: id });
    if (role === "student") {
      // Do not expose answer keys while students view/attempt tests.
      questionQuery = questionQuery.select("-correctAnswer");
    }

    const questions = await questionQuery;

    const payload = {
      ...test.toObject(),
      questions,
    };

    if (attemptInfo) {
      payload.attempt = attemptInfo;
    }

    return res.json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch test" });
  }
};

/* ===============================
   LIST TESTS
=============================== */
export const listTests = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const role = req.user.role;

    if (role === "teacher") {
      const tests = await Test.find({
        createdBy: userId,
      }).sort({ createdAt: -1 });

      if (!tests.length) {
        return res.json([]);
      }

      const minClarityScore = Number(process.env.AI_MIN_CLARITY_SCORE || 5);
      const testIds = tests.map((t) => t._id);
      const questions = await Question.find({
        test: { $in: testIds },
      }).select("test aiReview.clarityScore");

      const statsByTestId = new Map();
      for (const q of questions) {
        const key = String(q.test);
        const existing = statsByTestId.get(key) || {
          totalQuestions: 0,
          reviewedQuestions: 0,
          passedQuestions: 0,
        };

        existing.totalQuestions += 1;

        const clarityScore = Number(q.aiReview?.clarityScore);
        if (Number.isFinite(clarityScore)) {
          existing.reviewedQuestions += 1;
        }
        if (Number.isFinite(clarityScore) && clarityScore >= minClarityScore) {
          existing.passedQuestions += 1;
        }

        statsByTestId.set(key, existing);
      }

      const testsWithReadiness = tests.map((t) => {
        const stats = statsByTestId.get(String(t._id)) || {
          totalQuestions: 0,
          reviewedQuestions: 0,
          passedQuestions: 0,
        };

        const failedQuestions = stats.totalQuestions - stats.passedQuestions;
        const aiReady = stats.totalQuestions > 0 && failedQuestions === 0;

        return {
          ...t.toObject(),
          aiReadiness: {
            aiReady,
            minClarityScore,
            totalQuestions: stats.totalQuestions,
            reviewedQuestions: stats.reviewedQuestions,
            passedQuestions: stats.passedQuestions,
            failedQuestions,
          },
        };
      });

      return res.json(testsWithReadiness);
    }

    if (role === "student") {
      const enrollments = await Enrollment.find({
        student: userId,
      });

      if (!enrollments.length) {
        return res.json([]);
      }

      const allowedByTeacher = new Map();
      enrollments.forEach((e) => {
        const teacherId = String(e.teacher);
        if (!allowedByTeacher.has(teacherId)) {
          allowedByTeacher.set(teacherId, new Set());
        }
        allowedByTeacher.get(teacherId).add(normalizeSubject(e.subject));
      });

      const teacherIds = [...allowedByTeacher.keys()];
      const tests = await Test.find({
        createdBy: { $in: teacherIds },
        isPublished: true,
      }).sort({ createdAt: -1 });

      const visibleTests = tests.filter((t) => {
        const allowedSubjects = allowedByTeacher.get(String(t.createdBy));
        return allowedSubjects?.has(normalizeSubject(t.subject));
      });

      return res.json(visibleTests);
    }

    if (role === "admin") {
      const tests = await Test.find().sort({
        createdAt: -1,
      });
      return res.json(tests);
    }

    return res.status(403).json({
      message: "Access denied",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch tests",
    });
  }
};

/* ===============================
   TOGGLE PUBLISH (Teacher Only)
=============================== */
export const togglePublishTest = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user._id || req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    let test;
    if (req.user.role === "admin") {
      test = await Test.findById(id);
    } else {
      test = await Test.findOne({
        _id: id,
        createdBy: teacherId,
      });
    }

    if (!test) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    const nextPublishState = !test.isPublished;

    if (nextPublishState) {
      const minClarityScore = Number(process.env.AI_MIN_CLARITY_SCORE || 5);
      const questions = await Question.find({ test: test._id }).select(
        "_id text aiReview"
      );

      if (!questions.length) {
        return res.status(400).json({
          message: "Add at least one question before publishing",
        });
      }

      const failed = questions.filter((q) => {
        const score = Number(q.aiReview?.clarityScore);
        return !Number.isFinite(score) || score < minClarityScore;
      });

      if (failed.length) {
        return res.status(400).json({
          message: `Cannot publish. ${failed.length} question(s) have no valid AI review or clarity score below ${minClarityScore}.`,
          minClarityScore,
          failedQuestions: failed.slice(0, 5).map((q) => ({
            id: q._id,
            text: q.text,
            clarityScore: q.aiReview?.clarityScore ?? null,
          })),
        });
      }
    }

    test.isPublished = nextPublishState;
    await test.save();

    await writeAuditLog({
      action: "teacher.test.publish_toggled",
      actor: {
        _id: teacherId,
        role: req.user.role,
      },
      target: "test",
      targetId: test._id,
      meta: {
        isPublished: test.isPublished,
        title: test.title,
        subject: test.subject,
      },
    });

    return res.json({
      message: test.isPublished
        ? "Test published successfully"
        : "Test unpublished successfully",
      isPublished: test.isPublished,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to update publish state",
    });
  }
};

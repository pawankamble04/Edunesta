import mongoose from "mongoose";
import Question from "../models/Question.js";
import Test from "../models/Test.js";
import Enrollment from "../models/Enrollment.js";
import { normalizeSubject } from "../utils/subject.js";

const sanitizeAiReview = (review) => {
  if (!review || typeof review !== "object") return null;

  const clarityScore = Number(review.clarityScore);
  if (!Number.isFinite(clarityScore) || clarityScore < 1 || clarityScore > 10) {
    return null;
  }

  const rawDifficulty = String(review.difficulty || "").trim().toLowerCase();
  let difficulty = "Medium";
  if (rawDifficulty === "easy") difficulty = "Easy";
  if (rawDifficulty === "hard") difficulty = "Hard";

  const issues = Array.isArray(review.issues)
    ? review.issues.map((v) => String(v)).filter(Boolean)
    : [];

  const improvementSuggestions = Array.isArray(review.improvementSuggestions)
    ? review.improvementSuggestions.map((v) => String(v)).filter(Boolean)
    : [];

  return {
    clarityScore,
    difficulty,
    issues,
    improvementSuggestions,
    reviewedAt: new Date(),
  };
};

const isAiReviewPassing = (review) => {
  if (!review) return false;
  const minClarityScore = Number(process.env.AI_MIN_CLARITY_SCORE || 5);
  return Number(review.clarityScore) >= minClarityScore;
};

const sanitizePyqMeta = (payload = {}) => {
  const isPyq = Boolean(payload.isPyq);
  const rawExam = String(payload.pyqExamType || "").trim().toUpperCase();
  const pyqExamType =
    isPyq && ["JEE", "NEET"].includes(rawExam) ? rawExam : "";
  const rawYear = Number(payload.pyqYear);
  const pyqYear =
    isPyq && Number.isInteger(rawYear) && rawYear >= 1990 && rawYear <= 2100
      ? rawYear
      : null;
  const pyqSource = isPyq ? String(payload.pyqSource || "").trim().slice(0, 120) : "";

  return {
    isPyq,
    pyqExamType,
    pyqYear,
    pyqSource,
  };
};

export const addQuestion = async (req, res) => {
  try {
    const { testId } = req.params;
    const { text, options, correctAnswer, marks, topic, aiReview } = req.body;
    const teacherId = req.user._id || req.user.id;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    if (!text || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: "Invalid question data" });
    }

    const test = await Test.findOne({
      _id: testId,
      createdBy: teacherId,
    });

    if (!test) {
      return res.status(403).json({
        message: "You cannot add questions to this test",
      });
    }

    const cleanAiReview = sanitizeAiReview(aiReview);
    if (!isAiReviewPassing(cleanAiReview)) {
      return res.status(400).json({
        message: `AI review is required and clarity score must be at least ${
          Number(process.env.AI_MIN_CLARITY_SCORE || 5)
        }`,
      });
    }
    const pyqMeta = sanitizePyqMeta(req.body || {});

    const question = await Question.create({
      test: testId,
      text,
      options,
      correctAnswer,
      marks,
      topic,
      ...pyqMeta,
      aiReview: cleanAiReview,
    });

    return res.json(question);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to add question" });
  }
};

export const getQuestionsByTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user._id || req.user.id;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    if (req.user.role === "teacher") {
      if (String(test.createdBy) !== String(userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (req.user.role === "student") {
      if (!test.isPublished) {
        return res.status(403).json({ message: "Access denied" });
      }

      const enrollments = await Enrollment.find({
        student: userId,
        teacher: test.createdBy,
      });

      const isEnrolledForSubject = enrollments.some(
        (e) => normalizeSubject(e.subject) === normalizeSubject(test.subject)
      );

      if (!isEnrolledForSubject) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    let query = Question.find({ test: testId });

    // Hide answer keys from students while attempting tests.
    if (req.user.role === "student") {
      query = query.select("-correctAnswer");
    }

    const questions = await query;
    return res.json(questions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch questions" });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user._id || req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid question ID" });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const ownedTest = await Test.findOne({
      _id: question.test,
      createdBy: teacherId,
    });

    if (!ownedTest) {
      return res.status(403).json({
        message: "You cannot edit this question",
      });
    }

    const payload = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(payload, "aiReview")) {
      payload.aiReview = sanitizeAiReview(payload.aiReview);
    }
    const hasPyqField =
      Object.prototype.hasOwnProperty.call(payload, "isPyq") ||
      Object.prototype.hasOwnProperty.call(payload, "pyqExamType") ||
      Object.prototype.hasOwnProperty.call(payload, "pyqYear") ||
      Object.prototype.hasOwnProperty.call(payload, "pyqSource");
    if (hasPyqField) {
      const pyqMeta = sanitizePyqMeta(payload);
      payload.isPyq = pyqMeta.isPyq;
      payload.pyqExamType = pyqMeta.pyqExamType;
      payload.pyqYear = pyqMeta.pyqYear;
      payload.pyqSource = pyqMeta.pyqSource;
    }

    const hasCoreChange =
      Object.prototype.hasOwnProperty.call(payload, "text") ||
      Object.prototype.hasOwnProperty.call(payload, "options") ||
      Object.prototype.hasOwnProperty.call(payload, "correctAnswer") ||
      Object.prototype.hasOwnProperty.call(payload, "topic");

    if (hasCoreChange && !Object.prototype.hasOwnProperty.call(payload, "aiReview")) {
      payload.aiReview = null;
    }

    if (hasCoreChange && !isAiReviewPassing(payload.aiReview)) {
      return res.status(400).json({
        message: `Re-run AI review and keep clarity score at least ${
          Number(process.env.AI_MIN_CLARITY_SCORE || 5)
        } before saving`,
      });
    }

    const updated = await Question.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update question" });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user._id || req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid question ID" });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const ownedTest = await Test.findOne({
      _id: question.test,
      createdBy: teacherId,
    });

    if (!ownedTest) {
      return res.status(403).json({
        message: "You cannot delete this question",
      });
    }

    await Question.findByIdAndDelete(id);
    return res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete question" });
  }
};

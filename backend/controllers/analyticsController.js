import mongoose from "mongoose";
import Submission from "../models/Submission.js";
import Test from "../models/Test.js";
import ParentStudentLink from "../models/ParentStudentLink.js";
import Enrollment from "../models/Enrollment.js";
import Question from "../models/Question.js";
import { normalizeSubject } from "../utils/subject.js";

const resolveUserId = (req) => req.user?._id || req.user?.id || null;
const TOPIC_MASTERY_WEAK_THRESHOLD = 60;
const TOPIC_MASTERY_STRONG_THRESHOLD = 80;
const MICRO_RETEST_MIN_QUESTIONS = 3;
const MICRO_RETEST_MAX_QUESTIONS = 10;
const MICRO_RETEST_DEFAULT_QUESTIONS = 5;
const PYQ_PRACTICE_MIN_QUESTIONS = 5;
const PYQ_PRACTICE_MAX_QUESTIONS = 40;
const PYQ_PRACTICE_DEFAULT_QUESTIONS = 10;
const PYQ_EXAM_TYPES = new Set(["JEE", "NEET"]);
const PYQ_SUBJECTS_BY_EXAM = {
  JEE: ["physics", "chemistry", "math"],
  NEET: ["physics", "chemistry", "biology"],
};

const emptyAnalytics = () => ({
  progress: [],
  subjectPerformance: {},
  accuracy: 0,
  averageScore: 0,
});

const toTopicKey = (value) => String(value || "general").trim().toLowerCase() || "general";

const toTopicLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "General";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const toMasteryLevel = (percent) => {
  if (percent >= TOPIC_MASTERY_STRONG_THRESHOLD) return "Mastered";
  if (percent >= TOPIC_MASTERY_WEAK_THRESHOLD) return "Developing";
  return "Weak";
};

const toSubjectLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "math") return "Mathematics";
  if (normalized === "chemistry") return "Chemistry";
  if (normalized === "physics") return "Physics";
  if (normalized === "biology") return "Biology";
  if (!normalized) return "General";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizePyqExamType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!PYQ_EXAM_TYPES.has(normalized)) return "";
  return normalized;
};

const normalizePyqSubject = (value) => {
  const normalized = normalizeSubject(value);
  return normalized || "";
};

const clampInt = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return Math.min(Math.max(rounded, min), max);
};

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const sample = (items, count) => {
  if (!Array.isArray(items) || count <= 0) return [];
  if (items.length <= count) return [...items];
  return shuffle(items).slice(0, count);
};

const getVisibleTestsForStudent = async (studentId) => {
  const enrollments = await Enrollment.find({ student: studentId }).select(
    "teacher subject"
  );
  if (!enrollments.length) return [];

  const allowedByTeacher = new Map();
  enrollments.forEach((enrollment) => {
    const teacherId = String(enrollment.teacher);
    if (!allowedByTeacher.has(teacherId)) {
      allowedByTeacher.set(teacherId, new Set());
    }
    allowedByTeacher
      .get(teacherId)
      .add(normalizeSubject(enrollment.subject));
  });

  const teacherIds = [...allowedByTeacher.keys()];
  const tests = await Test.find({
    createdBy: { $in: teacherIds },
    isPublished: true,
  }).select("_id createdBy subject");

  return tests.filter((test) => {
    const allowedSubjects = allowedByTeacher.get(String(test.createdBy));
    return allowedSubjects?.has(normalizeSubject(test.subject));
  });
};

const buildTopicMasteryData = async ({ studentId, visibleTests }) => {
  const testIds = (visibleTests || []).map((test) => test._id);
  if (!testIds.length) {
    return {
      topics: [],
      weakTopics: [],
      weakTopicKeys: [],
      testIds: [],
    };
  }

  const submissions = await Submission.find({
    student: studentId,
    test: { $in: testIds },
  }).select("answers submittedAt");

  if (!submissions.length) {
    return {
      topics: [],
      weakTopics: [],
      weakTopicKeys: [],
      testIds,
    };
  }

  const questionIds = [
    ...new Set(
      submissions.flatMap((submission) =>
        (submission.answers || [])
          .map((answer) => String(answer.question || ""))
          .filter((value) => mongoose.Types.ObjectId.isValid(value))
      )
    ),
  ];

  if (!questionIds.length) {
    return {
      topics: [],
      weakTopics: [],
      weakTopicKeys: [],
      testIds,
    };
  }

  const questions = await Question.find({
    _id: { $in: questionIds },
  }).select("_id topic correctAnswer marks");
  const questionById = new Map(
    questions.map((question) => [String(question._id), question])
  );

  const statsByTopicKey = new Map();

  submissions.forEach((submission) => {
    const attemptedAt = submission.submittedAt
      ? new Date(submission.submittedAt)
      : null;

    (submission.answers || []).forEach((answer) => {
      const question = questionById.get(String(answer.question || ""));
      if (!question) return;

      const topicKey = toTopicKey(question.topic);
      const existing = statsByTopicKey.get(topicKey) || {
        topic: toTopicLabel(question.topic),
        attempted: 0,
        correct: 0,
        scoredMarks: 0,
        totalMarks: 0,
        lastAttemptedAt: null,
      };

      const hasSelection =
        answer.selected !== null &&
        answer.selected !== undefined &&
        String(answer.selected).trim() !== "";
      const selected = Number(answer.selected);
      const isCorrect =
        hasSelection && Number.isFinite(selected)
          ? selected === Number(question.correctAnswer)
          : false;
      const marks = Number(question.marks) || 1;

      existing.attempted += 1;
      if (isCorrect) {
        existing.correct += 1;
        existing.scoredMarks += marks;
      }
      existing.totalMarks += marks;

      if (
        attemptedAt &&
        (!existing.lastAttemptedAt || attemptedAt > existing.lastAttemptedAt)
      ) {
        existing.lastAttemptedAt = attemptedAt;
      }

      statsByTopicKey.set(topicKey, existing);
    });
  });

  const topicsByWeakness = [...statsByTopicKey.entries()]
    .map(([topicKey, row]) => {
      const masteryPercent =
        row.totalMarks > 0
          ? Number(((row.scoredMarks / row.totalMarks) * 100).toFixed(2))
          : Number(((row.correct / Math.max(row.attempted, 1)) * 100).toFixed(2));

      return {
        topicKey,
        topic: row.topic,
        attempted: row.attempted,
        correct: row.correct,
        scoredMarks: row.scoredMarks,
        totalMarks: row.totalMarks,
        masteryPercent,
        level: toMasteryLevel(masteryPercent),
        lastAttemptedAt: row.lastAttemptedAt
          ? row.lastAttemptedAt.toISOString()
          : null,
      };
    })
    .sort(
      (a, b) =>
        a.masteryPercent - b.masteryPercent ||
        b.attempted - a.attempted ||
        a.topic.localeCompare(b.topic)
    );

  const weakRows = topicsByWeakness.filter(
    (row) => row.masteryPercent < TOPIC_MASTERY_WEAK_THRESHOLD && row.attempted >= 2
  );
  const fallbackWeakRows =
    weakRows.length > 0 ? weakRows : topicsByWeakness.slice(0, 2);

  const weakTopics = fallbackWeakRows.slice(0, 5).map((row) => ({
    topic: row.topic,
    masteryPercent: row.masteryPercent,
    attempted: row.attempted,
    level: row.level,
  }));

  const weakTopicKeys = fallbackWeakRows.slice(0, 5).map((row) => row.topicKey);
  const topics = [...topicsByWeakness]
    .sort((a, b) => a.topic.localeCompare(b.topic))
    .map(({ topicKey, ...row }) => row);

  return {
    topics,
    weakTopics,
    weakTopicKeys,
    testIds,
  };
};

const buildStudentAnalytics = async (studentId) => {
  const submissions = await Submission.find({ student: studentId })
    .populate("test", "subject totalMarks")
    .sort({ createdAt: 1 });

  if (!submissions.length) {
    return emptyAnalytics();
  }

  const progress = [];
  const subjectPerformance = {};
  let totalScore = 0;
  let totalMarks = 0;

  submissions.forEach((s) => {
    if (!s?.test) return;

    const subject = String(s.test.subject || "general");
    const score = Number(s.score) || 0;
    const marks = Number(s.test.totalMarks) || 0;

    progress.push({
      date: s.createdAt,
      score,
      total: marks,
    });

    if (!subjectPerformance[subject]) {
      subjectPerformance[subject] = {
        scored: 0,
        total: 0,
      };
    }

    subjectPerformance[subject].scored += score;
    subjectPerformance[subject].total += marks;

    totalScore += score;
    totalMarks += marks;
  });

  const accuracy =
    totalMarks > 0 ? Number(((totalScore / totalMarks) * 100).toFixed(2)) : 0;
  const averageScore =
    progress.length > 0 ? Number((totalScore / progress.length).toFixed(2)) : 0;

  return {
    progress,
    subjectPerformance,
    accuracy,
    averageScore,
  };
};

export const getStudentAnalytics = async (req, res) => {
  try {
    const studentId = resolveUserId(req);
    if (!studentId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const analytics = await buildStudentAnalytics(studentId);
    return res.json(analytics);
  } catch (error) {
    console.error("Student analytics error:", error);
    return res.status(500).json({ message: "Failed to load student analytics" });
  }
};

export const getStudentTopicMastery = async (req, res) => {
  try {
    const studentId = resolveUserId(req);
    if (!studentId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const visibleTests = await getVisibleTestsForStudent(studentId);
    const mastery = await buildTopicMasteryData({
      studentId,
      visibleTests,
    });

    return res.json({
      topics: mastery.topics,
      weakTopics: mastery.weakTopics,
    });
  } catch (error) {
    console.error("Student topic mastery error:", error);
    return res.status(500).json({ message: "Failed to load topic mastery" });
  }
};

export const generateStudentMicroRetest = async (req, res) => {
  try {
    const studentId = resolveUserId(req);
    if (!studentId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const count = clampInt(
      req.body?.count,
      MICRO_RETEST_MIN_QUESTIONS,
      MICRO_RETEST_MAX_QUESTIONS,
      MICRO_RETEST_DEFAULT_QUESTIONS
    );

    const visibleTests = await getVisibleTestsForStudent(studentId);
    const mastery = await buildTopicMasteryData({
      studentId,
      visibleTests,
    });

    if (!mastery.testIds.length) {
      return res.status(400).json({
        message: "No accessible tests found for micro-retest generation",
      });
    }

    const requestedTopicKeys = Array.isArray(req.body?.topics)
      ? req.body.topics
          .map((topic) => toTopicKey(topic))
          .filter(Boolean)
      : [];

    let targetTopicKeys =
      requestedTopicKeys.length > 0 ? requestedTopicKeys : mastery.weakTopicKeys;

    if (!targetTopicKeys.length && mastery.topics.length > 0) {
      targetTopicKeys = mastery.topics
        .slice(0, 3)
        .map((topic) => toTopicKey(topic.topic));
    }

    if (!targetTopicKeys.length) {
      return res.status(400).json({
        message: "No topic data available yet. Attempt at least one test first.",
      });
    }

    const allQuestions = await Question.find({
      test: { $in: mastery.testIds },
    }).select("_id text options topic aiReview.difficulty");

    const candidates = allQuestions
      .map((question) => ({
        id: String(question._id),
        topicKey: toTopicKey(question.topic),
        topic: toTopicLabel(question.topic),
        text: String(question.text || "").trim(),
        options: Array.isArray(question.options) ? question.options : [],
        difficulty: question.aiReview?.difficulty || "Medium",
      }))
      .filter((question) => question.text && question.options.length >= 2);

    const selectedIds = new Set();
    const selected = [];

    const targetSet = new Set(targetTopicKeys);
    const primaryPool = candidates.filter((question) =>
      targetSet.has(question.topicKey)
    );

    sample(primaryPool, count).forEach((question) => {
      selected.push(question);
      selectedIds.add(question.id);
    });

    if (selected.length < count) {
      const secondaryPool = candidates.filter(
        (question) => !selectedIds.has(question.id)
      );
      sample(secondaryPool, count - selected.length).forEach((question) => {
        selected.push(question);
        selectedIds.add(question.id);
      });
    }

    if (!selected.length) {
      return res.status(400).json({
        message: "Question bank is not ready for micro-retest yet",
      });
    }

    return res.json({
      mastery: {
        topics: mastery.topics,
        weakTopics: mastery.weakTopics,
      },
      retest: {
        generatedAt: new Date().toISOString(),
        requestedCount: count,
        questionCount: selected.length,
        targetTopics: [...new Set(selected.map((question) => question.topic))],
        questions: selected.map((question, index) => ({
          id: question.id,
          order: index + 1,
          text: question.text,
          options: question.options,
          topic: question.topic,
          difficulty: question.difficulty,
        })),
      },
    });
  } catch (error) {
    console.error("Generate micro-retest error:", error);
    return res.status(500).json({
      message: "Failed to generate micro-retest",
    });
  }
};

export const submitStudentMicroRetest = async (req, res) => {
  try {
    const studentId = resolveUserId(req);
    if (!studentId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!Array.isArray(req.body?.answers) || req.body.answers.length === 0) {
      return res.status(400).json({
        message: "answers array is required",
      });
    }

    const normalizedAnswers = req.body.answers
      .map((entry) => ({
        questionId: String(entry?.questionId || "").trim(),
        selected: Number(entry?.selected),
      }))
      .filter(
        (entry) =>
          mongoose.Types.ObjectId.isValid(entry.questionId) &&
          Number.isFinite(entry.selected)
      );

    const answerMap = new Map();
    normalizedAnswers.forEach((entry) => {
      answerMap.set(entry.questionId, Math.floor(entry.selected));
    });

    const questionIds = [...answerMap.keys()];
    if (!questionIds.length) {
      return res.status(400).json({
        message: "No valid answers provided",
      });
    }

    if (questionIds.length > 30) {
      return res.status(400).json({
        message: "Too many answers submitted",
      });
    }

    const visibleTests = await getVisibleTestsForStudent(studentId);
    const visibleTestIds = visibleTests.map((test) => test._id);

    const questions = await Question.find({
      _id: { $in: questionIds },
      test: { $in: visibleTestIds },
    }).select("_id correctAnswer topic");

    if (questions.length !== questionIds.length) {
      return res.status(400).json({
        message: "Invalid micro-retest question set",
      });
    }

    let correctAnswers = 0;
    const topicBreakdownMap = new Map();

    questions.forEach((question) => {
      const questionId = String(question._id);
      const selected = answerMap.get(questionId);
      const isCorrect = selected === Number(question.correctAnswer);
      const topic = toTopicLabel(question.topic);

      if (isCorrect) correctAnswers += 1;

      const current = topicBreakdownMap.get(topic) || {
        topic,
        attempted: 0,
        correct: 0,
      };
      current.attempted += 1;
      if (isCorrect) current.correct += 1;
      topicBreakdownMap.set(topic, current);
    });

    const totalQuestions = questions.length;
    const accuracy = Number(
      ((correctAnswers / Math.max(totalQuestions, 1)) * 100).toFixed(2)
    );

    const topicBreakdown = [...topicBreakdownMap.values()]
      .map((row) => ({
        ...row,
        accuracy: Number(
          ((row.correct / Math.max(row.attempted, 1)) * 100).toFixed(2)
        ),
      }))
      .sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted);

    const weakTopics = topicBreakdown
      .filter((topic) => topic.accuracy < TOPIC_MASTERY_WEAK_THRESHOLD)
      .map((topic) => topic.topic);

    return res.json({
      result: {
        submittedAt: new Date().toISOString(),
        totalQuestions,
        correctAnswers,
        accuracy,
        scoreText: `${correctAnswers}/${totalQuestions}`,
        topicBreakdown,
        weakTopics,
      },
    });
  } catch (error) {
    console.error("Submit micro-retest error:", error);
    return res.status(500).json({
      message: "Failed to submit micro-retest",
    });
  }
};

export const generateStudentPyqPractice = async (req, res) => {
  try {
    const studentId = resolveUserId(req);
    if (!studentId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const examType = normalizePyqExamType(req.body?.examType);
    if (!examType) {
      return res.status(400).json({
        message: "examType is required and must be JEE or NEET",
      });
    }

    const count = clampInt(
      req.body?.count,
      PYQ_PRACTICE_MIN_QUESTIONS,
      PYQ_PRACTICE_MAX_QUESTIONS,
      PYQ_PRACTICE_DEFAULT_QUESTIONS
    );

    const allowedSubjects = PYQ_SUBJECTS_BY_EXAM[examType] || [];
    const requestedSubject = normalizePyqSubject(req.body?.subject);
    const subjectFilter =
      requestedSubject && allowedSubjects.includes(requestedSubject)
        ? requestedSubject
        : "";
    if (requestedSubject && !subjectFilter) {
      return res.status(400).json({
        message: `${req.body?.subject} is not valid for ${examType}`,
      });
    }

    const currentYear = new Date().getFullYear();
    const yearFrom = clampInt(req.body?.yearFrom, 1990, currentYear + 1, 1990);
    const yearTo = clampInt(req.body?.yearTo, 1990, currentYear + 1, currentYear);
    const minYear = Math.min(yearFrom, yearTo);
    const maxYear = Math.max(yearFrom, yearTo);

    const visibleTests = await getVisibleTestsForStudent(studentId);
    const filteredTests = visibleTests.filter((test) => {
      const normalized = normalizeSubject(test.subject);
      if (!allowedSubjects.includes(normalized)) return false;
      if (subjectFilter && normalized !== subjectFilter) return false;
      return true;
    });

    const testIds = filteredTests.map((test) => test._id);
    if (!testIds.length) {
      return res.status(400).json({
        message: "No accessible tests available for selected exam/subject",
      });
    }

    const pyqQuestions = await Question.find({
      test: { $in: testIds },
      isPyq: true,
      pyqExamType: examType,
      ...(minYear && maxYear
        ? {
            pyqYear: {
              $gte: minYear,
              $lte: maxYear,
            },
          }
        : {}),
    }).select(
      "_id text options topic aiReview.difficulty isPyq pyqExamType pyqYear pyqSource"
    );

    const normalizedPyq = pyqQuestions
      .map((question) => ({
        id: String(question._id),
        text: String(question.text || "").trim(),
        options: Array.isArray(question.options) ? question.options : [],
        topic: toTopicLabel(question.topic),
        difficulty: question.aiReview?.difficulty || "Medium",
        isPyq: Boolean(question.isPyq),
        pyqExamType: question.pyqExamType || "",
        pyqYear: Number(question.pyqYear) || null,
        pyqSource: String(question.pyqSource || "").trim(),
      }))
      .filter((question) => question.text && question.options.length >= 2);

    const selected = sample(normalizedPyq, count);
    let fallbackUsed = false;
    let warning = "";

    if (selected.length < count) {
      fallbackUsed = true;

      const selectedIds = new Set(selected.map((question) => question.id));
      const fallbackQuestions = await Question.find({
        test: { $in: testIds },
        _id: { $nin: [...selectedIds] },
      }).select("_id text options topic aiReview.difficulty isPyq pyqYear pyqSource");

      const normalizedFallback = fallbackQuestions
        .map((question) => ({
          id: String(question._id),
          text: String(question.text || "").trim(),
          options: Array.isArray(question.options) ? question.options : [],
          topic: toTopicLabel(question.topic),
          difficulty: question.aiReview?.difficulty || "Medium",
          isPyq: Boolean(question.isPyq),
          pyqExamType: question.pyqExamType || "",
          pyqYear: Number(question.pyqYear) || null,
          pyqSource: String(question.pyqSource || "").trim(),
        }))
        .filter((question) => question.text && question.options.length >= 2);

      sample(normalizedFallback, count - selected.length).forEach((question) =>
        selected.push(question)
      );
      warning =
        "Not enough tagged PYQ questions found. Mixed practice set generated using available questions.";
    }

    if (!selected.length) {
      return res.status(400).json({
        message: "Question bank is not ready for PYQ practice yet",
      });
    }

    return res.json({
      practice: {
        generatedAt: new Date().toISOString(),
        examType,
        subject: subjectFilter ? toSubjectLabel(subjectFilter) : "All",
        yearFrom: minYear,
        yearTo: maxYear,
        requestedCount: count,
        questionCount: selected.length,
        source: fallbackUsed ? "mixed" : "pyq",
        warning,
        questions: selected.map((question, index) => ({
          id: question.id,
          order: index + 1,
          text: question.text,
          options: question.options,
          topic: question.topic,
          difficulty: question.difficulty,
          isPyq: question.isPyq,
          pyqYear: question.pyqYear,
          pyqSource: question.pyqSource,
        })),
      },
    });
  } catch (error) {
    console.error("Generate PYQ practice error:", error);
    return res.status(500).json({
      message: "Failed to generate PYQ practice",
    });
  }
};

export const submitStudentPyqPractice = async (req, res) => {
  try {
    const studentId = resolveUserId(req);
    if (!studentId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!Array.isArray(req.body?.answers) || req.body.answers.length === 0) {
      return res.status(400).json({
        message: "answers array is required",
      });
    }

    const normalizedAnswers = req.body.answers
      .map((entry) => ({
        questionId: String(entry?.questionId || "").trim(),
        selected: Number(entry?.selected),
      }))
      .filter(
        (entry) =>
          mongoose.Types.ObjectId.isValid(entry.questionId) &&
          Number.isFinite(entry.selected)
      );

    const answerMap = new Map();
    normalizedAnswers.forEach((entry) => {
      answerMap.set(entry.questionId, Math.floor(entry.selected));
    });

    const questionIds = [...answerMap.keys()];
    if (!questionIds.length) {
      return res.status(400).json({
        message: "No valid answers provided",
      });
    }
    if (questionIds.length > 100) {
      return res.status(400).json({
        message: "Too many answers submitted",
      });
    }

    const visibleTests = await getVisibleTestsForStudent(studentId);
    const visibleTestIds = visibleTests.map((test) => test._id);

    const questions = await Question.find({
      _id: { $in: questionIds },
      test: { $in: visibleTestIds },
    }).select("_id correctAnswer topic pyqYear");

    if (questions.length !== questionIds.length) {
      return res.status(400).json({
        message: "Invalid PYQ practice question set",
      });
    }

    let correctAnswers = 0;
    const topicBreakdownMap = new Map();
    const yearBreakdownMap = new Map();

    questions.forEach((question) => {
      const questionId = String(question._id);
      const selected = answerMap.get(questionId);
      const isCorrect = selected === Number(question.correctAnswer);
      const topic = toTopicLabel(question.topic);
      const year = Number(question.pyqYear) || null;

      if (isCorrect) correctAnswers += 1;

      const topicRow = topicBreakdownMap.get(topic) || {
        topic,
        attempted: 0,
        correct: 0,
      };
      topicRow.attempted += 1;
      if (isCorrect) topicRow.correct += 1;
      topicBreakdownMap.set(topic, topicRow);

      const yearKey = year || "Unknown";
      const yearRow = yearBreakdownMap.get(yearKey) || {
        year: year || null,
        attempted: 0,
        correct: 0,
      };
      yearRow.attempted += 1;
      if (isCorrect) yearRow.correct += 1;
      yearBreakdownMap.set(yearKey, yearRow);
    });

    const totalQuestions = questions.length;
    const accuracy = Number(
      ((correctAnswers / Math.max(totalQuestions, 1)) * 100).toFixed(2)
    );

    const topicBreakdown = [...topicBreakdownMap.values()]
      .map((row) => ({
        ...row,
        accuracy: Number(
          ((row.correct / Math.max(row.attempted, 1)) * 100).toFixed(2)
        ),
      }))
      .sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted);

    const yearBreakdown = [...yearBreakdownMap.values()]
      .map((row) => ({
        ...row,
        accuracy: Number(
          ((row.correct / Math.max(row.attempted, 1)) * 100).toFixed(2)
        ),
      }))
      .sort((a, b) => (b.year || 0) - (a.year || 0));

    const weakTopics = topicBreakdown
      .filter((topic) => topic.accuracy < TOPIC_MASTERY_WEAK_THRESHOLD)
      .map((topic) => topic.topic);

    return res.json({
      result: {
        submittedAt: new Date().toISOString(),
        totalQuestions,
        correctAnswers,
        accuracy,
        scoreText: `${correctAnswers}/${totalQuestions}`,
        topicBreakdown,
        yearBreakdown,
        weakTopics,
      },
    });
  } catch (error) {
    console.error("Submit PYQ practice error:", error);
    return res.status(500).json({
      message: "Failed to submit PYQ practice",
    });
  }
};

export const getParentAnalytics = async (req, res) => {
  try {
    const parentId = resolveUserId(req);
    if (!parentId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const requestedStudentId = String(req.query.studentId || "").trim();
    let studentId = requestedStudentId;

    if (!studentId) {
      const firstLink = await ParentStudentLink.findOne({
        parentId,
        verified: true,
      })
        .select("studentId")
        .sort({ createdAt: 1 });

      if (!firstLink?.studentId) {
        return res
          .status(400)
          .json({ message: "No linked student found for parent account" });
      }

      studentId = String(firstLink.studentId);
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const isLinked = await ParentStudentLink.exists({
      parentId,
      studentId,
      verified: true,
    });

    if (!isLinked) {
      return res.status(403).json({ message: "Access denied" });
    }

    const analytics = await buildStudentAnalytics(studentId);
    return res.json({
      studentId,
      ...analytics,
    });
  } catch (error) {
    console.error("Parent analytics error:", error);
    return res.status(500).json({ message: "Failed to load parent analytics" });
  }
};

export const getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = resolveUserId(req);
    const { testId } = req.params;

    if (!teacherId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ message: "Invalid test ID" });
    }

    const ownedTest = await Test.findOne({
      _id: testId,
      createdBy: teacherId,
    }).select("_id");

    if (!ownedTest) {
      return res.status(404).json({ message: "Test not found" });
    }

    const submissions = await Submission.find({ test: testId }).select("score");

    if (!submissions.length) {
      return res.json({
        classAverage: 0,
        highestScore: 0,
        lowestScore: 0,
      });
    }

    let totalScore = 0;
    let highestScore = Number.NEGATIVE_INFINITY;
    let lowestScore = Number.POSITIVE_INFINITY;

    submissions.forEach((s) => {
      const score = Number(s.score) || 0;
      totalScore += score;
      if (score > highestScore) highestScore = score;
      if (score < lowestScore) lowestScore = score;
    });

    const classAverage = Number((totalScore / submissions.length).toFixed(2));

    return res.json({
      classAverage,
      highestScore: Number.isFinite(highestScore) ? highestScore : 0,
      lowestScore: Number.isFinite(lowestScore) ? lowestScore : 0,
    });
  } catch (error) {
    console.error("Teacher analytics error:", error);
    return res.status(500).json({ message: "Failed to load teacher analytics" });
  }
};

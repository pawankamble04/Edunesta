import { AIServiceError, askGemini } from "../utils/gemini.js";
import pdfParse from "pdf-parse";
import Submission from "../models/Submission.js";
import ParentStudentLink from "../models/ParentStudentLink.js";
import StudyPlan from "../models/StudyPlan.js";
import StudyBuddySession from "../models/StudyBuddySession.js";
import CodingRoadmap from "../models/CodingRoadmap.js";
import ExamAutoPlan from "../models/ExamAutoPlan.js";
import Test from "../models/Test.js";
import Enrollment from "../models/Enrollment.js";
import { normalizeSubject } from "../utils/subject.js";
import { getStudentDailySummary } from "../utils/dailySummary.js";
import { isPdfSignatureValid } from "../utils/pdfSecurity.js";

const getWeekRange = () => {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const CHAT_MESSAGE_MAX_LENGTH = 700;
const CHAT_HISTORY_MAX_TURNS = 8;
const CHAT_REPLY_MAX_LENGTH = 1800;
const CHAT_SESSION_MAX_MESSAGES = 120;
const CHAT_SESSION_RETURN_MESSAGES = 60;
const AUTO_MCQ_MIN_COUNT = 1;
const AUTO_MCQ_MAX_COUNT = 20;
const AUTO_MCQ_DEFAULT_COUNT = 10;
const AUTO_MCQ_MIN_PARAGRAPH_LENGTH = 80;
const AUTO_MCQ_MAX_PARAGRAPH_LENGTH = 12000;
const ROADMAP_MIN_MONTHS = 1;
const ROADMAP_MAX_MONTHS = 12;
const ROADMAP_DEFAULT_MONTHS = 1;
const ROADMAP_ALLOWED_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const ROADMAP_HISTORY_DEFAULT_LIMIT = 12;
const ROADMAP_HISTORY_MAX_LIMIT = 50;
const EXAM_AUTO_ALLOWED_TYPES = new Set(["JEE", "NEET"]);
const EXAM_AUTO_SUBJECTS = {
  JEE: ["physics", "chemistry", "math"],
  NEET: ["physics", "chemistry", "biology"],
};
const EXAM_AUTO_MIN_MONTHS = 1;
const EXAM_AUTO_MAX_MONTHS = 24;
const EXAM_AUTO_DEFAULT_MONTHS = 2;
const EXAM_AUTO_MIN_DAILY_HOURS = 1;
const EXAM_AUTO_MAX_DAILY_HOURS = 12;
const EXAM_AUTO_DEFAULT_DAILY_HOURS = 4;
const EXAM_AUTO_HISTORY_DEFAULT_LIMIT = 12;
const EXAM_AUTO_HISTORY_MAX_LIMIT = 50;
const STUDENT_CHAT_MODES = new Set([
  "quick_doubt",
  "weak_topic_drill",
  "exam_prep",
  "last_minute_revision",
]);
const TEACHER_CHAT_MODES = new Set([
  "class_insights",
  "intervention_plan",
  "question_improvement",
]);
const PARENT_CHAT_MODES = new Set([
  "daily_support",
  "motivation_coach",
  "weekly_planner",
]);

const createHttpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const getAiMeta = (error) => {
  if (error instanceof AIServiceError) {
    return {
      code: error.code || "AI_UNAVAILABLE",
      retryAfterSeconds: error.retryAfterSeconds || null,
      warning:
        error.code === "AI_QUOTA_EXCEEDED"
          ? "AI quota is currently exhausted. Fallback guidance is shown."
          : "AI service is temporarily unavailable. Fallback guidance is shown.",
    };
  }

  return {
    code: "AI_UNAVAILABLE",
    retryAfterSeconds: null,
    warning: "AI service is temporarily unavailable. Fallback guidance is shown.",
  };
};

const withAiFallbackMeta = (payload, error) => {
  const meta = getAiMeta(error);
  const result = {
    ...payload,
    source: "fallback",
    aiStatus: meta.code,
    warning: meta.warning,
  };

  if (meta.retryAfterSeconds) {
    result.retryAfterSeconds = meta.retryAfterSeconds;
  }

  return result;
};

const normalizeDifficulty = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "hard") return "Hard";
  return "Medium";
};

const parseReviewFromText = (text) => {
  const rawText = String(text || "");
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    const clarityScore = Number(parsed?.clarityScore);
    const issues = Array.isArray(parsed?.issues)
      ? parsed.issues.map((v) => String(v)).filter(Boolean)
      : [];
    const improvementSuggestions = Array.isArray(parsed?.improvementSuggestions)
      ? parsed.improvementSuggestions.map((v) => String(v)).filter(Boolean)
      : [];

    return {
      difficulty: normalizeDifficulty(parsed?.difficulty),
      clarityScore: Number.isFinite(clarityScore)
        ? Math.min(Math.max(clarityScore, 1), 10)
        : 6,
      issues,
      improvementSuggestions,
      reviewedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const buildQuestionFallbackReview = ({
  question,
  options,
  correctAnswer,
  topic,
}) => {
  const safeQuestion = String(question || "").trim();
  const safeOptions = Array.isArray(options)
    ? options.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const topicLabel = String(topic || "").trim();

  const issues = [];
  const improvementSuggestions = [];

  const uniqueOptions = new Set(safeOptions.map((v) => v.toLowerCase()));
  if (safeOptions.length >= 2 && uniqueOptions.size < safeOptions.length) {
    issues.push("Some options are duplicated.");
    improvementSuggestions.push("Make each option distinct and plausible.");
  }

  if (
    !Number.isInteger(correctAnswer) ||
    correctAnswer < 0 ||
    correctAnswer >= safeOptions.length
  ) {
    issues.push("Correct answer index appears invalid.");
    improvementSuggestions.push(
      "Ensure the correct answer index matches one option."
    );
  }

  if (safeQuestion.length < 20) {
    issues.push("Question text may be too short.");
    improvementSuggestions.push(
      "Add context so the question is unambiguous."
    );
  } else if (safeQuestion.length > 220) {
    issues.push("Question text may be too long.");
    improvementSuggestions.push("Shorten the stem to keep focus on one skill.");
  }

  if (!topicLabel) {
    issues.push("Topic is missing.");
    improvementSuggestions.push("Add a topic tag to improve analytics.");
  }

  if (!improvementSuggestions.length) {
    improvementSuggestions.push(
      "Add one distractor that targets a common misconception."
    );
  }

  let difficulty = "Medium";
  if (safeOptions.length <= 3 && safeQuestion.length < 110) difficulty = "Easy";
  if (safeOptions.length >= 5 || safeQuestion.length > 180) difficulty = "Hard";

  let clarityScore = 8;
  if (issues.length >= 3) clarityScore = 5;
  else if (issues.length >= 1) clarityScore = 6;

  return {
    difficulty,
    clarityScore,
    issues,
    improvementSuggestions,
    reviewedAt: new Date().toISOString(),
  };
};

const clampInt = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return Math.min(Math.max(rounded, min), max);
};

const sanitizeParagraphInput = (value) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, AUTO_MCQ_MAX_PARAGRAPH_LENGTH);

const sanitizePdfExtractedText = (value) =>
  sanitizeParagraphInput(
    String(value || "")
      .replace(/\u0000/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[^\S\r\n]{2,}/g, " ")
  );

const inferTopicFromFilename = (filename) =>
  String(filename || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

const parseCorrectAnswerIndex = (value, optionsLength) => {
  const safeLength = Number(optionsLength) || 0;
  if (safeLength < 2) return 0;

  const numeric = Number(value);
  if (Number.isInteger(numeric)) {
    if (numeric >= 0 && numeric < safeLength) return numeric;
    if (numeric >= 1 && numeric <= safeLength) return numeric - 1;
  }

  const normalized = String(value || "").trim().toUpperCase();
  if (/^[A-Z]$/.test(normalized)) {
    const idx = normalized.charCodeAt(0) - 65;
    if (idx >= 0 && idx < safeLength) return idx;
  }

  const fromLabel = normalized.match(/(\d+)/);
  if (fromLabel) {
    const parsed = Number(fromLabel[1]);
    if (Number.isInteger(parsed)) {
      if (parsed >= 0 && parsed < safeLength) return parsed;
      if (parsed >= 1 && parsed <= safeLength) return parsed - 1;
    }
  }

  return 0;
};

const parseGeneratedQuestionsFromText = (text) => {
  const raw = String(text || "").replace(/```json|```/gi, "").trim();
  if (!raw) return [];

  const candidates = [];
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (objectMatch) candidates.push(objectMatch[0]);
  if (arrayMatch) candidates.push(arrayMatch[0]);
  candidates.push(raw);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (Array.isArray(parsed?.questions)) {
        return parsed.questions;
      }
    } catch {
      // Continue with next parse candidate.
    }
  }

  return [];
};

const normalizeGeneratedQuestion = ({
  row,
  fallbackTopic,
  minClarityScore,
  defaultMarks,
}) => {
  const text = toShortText(row?.text || row?.question || "", 3000);
  if (text.length < 5) return null;

  const options = Array.isArray(row?.options)
    ? row.options
        .map((option) => String(option || "").trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];
  if (options.length < 2) return null;

  const correctAnswer = parseCorrectAnswerIndex(row?.correctAnswer, options.length);
  const topic = toShortText(row?.topic || fallbackTopic || "Comprehension", 120);
  const marksInput = Number(row?.marks);
  const marks = Number.isFinite(marksInput)
    ? Math.min(Math.max(Math.floor(marksInput), 1), 100)
    : defaultMarks;

  const fallbackReview = buildQuestionFallbackReview({
    question: text,
    options,
    correctAnswer,
    topic,
  });
  const providedReview =
    row?.aiReview && typeof row.aiReview === "object" ? row.aiReview : {};

  const rawClarityScore = Number(
    providedReview?.clarityScore ?? row?.clarityScore ?? fallbackReview.clarityScore
  );
  const clarityScore = Number.isFinite(rawClarityScore)
    ? Math.min(10, Math.max(minClarityScore, Math.round(rawClarityScore)))
    : Math.min(10, Math.max(minClarityScore, fallbackReview.clarityScore));

  const issues = Array.isArray(providedReview?.issues)
    ? providedReview.issues.map((entry) => toShortText(entry, 220)).filter(Boolean)
    : fallbackReview.issues;
  const improvementSuggestions = Array.isArray(providedReview?.improvementSuggestions)
    ? providedReview.improvementSuggestions
        .map((entry) => toShortText(entry, 220))
        .filter(Boolean)
    : fallbackReview.improvementSuggestions;

  return {
    text,
    options,
    correctAnswer,
    topic,
    marks,
    aiReview: {
      difficulty: normalizeDifficulty(
        providedReview?.difficulty || row?.difficulty || fallbackReview.difficulty
      ),
      clarityScore,
      issues,
      improvementSuggestions,
      reviewedAt: new Date().toISOString(),
    },
  };
};

const buildParagraphFallbackQuestions = ({
  paragraph,
  count,
  topic,
  minClarityScore,
  defaultMarks,
}) => {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((entry) => String(entry || "").trim())
    .filter((entry) => entry.length >= 25);

  if (!sentences.length) return [];

  const questions = [];
  for (let index = 0; index < count; index += 1) {
    const sentence = toShortText(sentences[index % sentences.length], 220);
    const stemPreview = toShortText(sentence, 90);

    questions.push({
      text: `According to the paragraph, which statement is correct about "${stemPreview}"?`,
      options: [
        sentence,
        "The paragraph says the complete opposite of this point.",
        "This detail is not discussed in the paragraph.",
        "The paragraph focuses on a different topic only.",
      ],
      correctAnswer: 0,
      topic,
      marks: defaultMarks,
      aiReview: {
        difficulty: "Medium",
        clarityScore: Math.min(10, Math.max(minClarityScore, 7)),
        issues: [],
        improvementSuggestions: [],
        reviewedAt: new Date().toISOString(),
      },
    });
  }

  return questions;
};

const buildWeakTopicFallbackSummary = (weakTopics) => {
  const ranked = Object.entries(weakTopics || {}).sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    return [
      "Weekly focus",
      "- No clear weak topic detected from recent submissions.",
      "- Continue mixed practice and track mistakes per topic.",
      "- Attempt one timed test and review every incorrect answer.",
    ].join("\n");
  }

  const top = ranked.slice(0, 4);
  const lines = ["Weekly focus on weak topics:"];

  for (const [topic, misses] of top) {
    lines.push(
      `- ${topic}: ${misses} incorrect answers. Revise concept notes, solve 10 targeted questions, then re-attempt one timed set.`
    );
  }

  lines.push("- Keep an error log: concept gap, mistake type, correction.");
  lines.push("- Revisit the top 2 weak topics after 3 days.");

  return lines.join("\n");
};

const buildNextStepsFallback = (stats) => {
  const attempted = Number(stats?.attempted || stats?.testsAttempted || 0);
  const accuracy = Number(
    stats?.accuracy ?? stats?.averageScore ?? stats?.avgScore ?? 0
  );
  const weakTopics = Array.isArray(stats?.weakTopics) ? stats.weakTopics : [];

  const level =
    accuracy >= 75 ? "advance to medium/hard sets" : "reinforce fundamentals";
  const weakTopicLine = weakTopics.length
    ? weakTopics.slice(0, 3).join(", ")
    : "general revision topics";

  return [
    "Next steps",
    `- Attempts so far: ${attempted}.`,
    `- Current accuracy: ${Number.isFinite(accuracy) ? accuracy : 0}%.`,
    `- Study priority: ${weakTopicLine}.`,
    `- Difficulty focus: ${level}.`,
    "- Practice strategy: 2 short timed sessions daily and one review block.",
    "- Motivation tip: track weekly improvement, not single-test variance.",
  ].join("\n");
};

const buildWeeklyPlanFallback = ({
  attempts,
  averageScore,
  weakSubjects,
  weakTopics,
}) => {
  const subjects = weakSubjects.length
    ? weakSubjects.join(", ")
    : "mixed-subject revision";
  const topics = weakTopics.length ? weakTopics.join(", ") : "core fundamentals";

  return [
    "1) Weekly Goal",
    `Raise consistency across ${subjects} with focused review and timed practice.`,
    "",
    "2) Day-wise Plan (Mon-Sun)",
    "Mon-Tue: concept revision + 20 focused questions.",
    "Wed-Thu: timed practice sets + error log cleanup.",
    "Fri: weak-topic drill and formula/notes recap.",
    "Sat: full mock test under exam timing.",
    "Sun: post-mock analysis and next-week prep.",
    "",
    "3) Topic Focus",
    topics,
    "",
    "4) Practice Strategy",
    "Use short timed blocks, then immediate correction for every wrong answer.",
    "",
    "5) Revision + Mock Test Plan",
    "One mock test this week and one full revision pass before the next test.",
    "",
    "6) Motivation Note",
    `You have ${attempts} attempts with average ${averageScore}%. Focus on steady weekly gains.`,
  ].join("\n");
};

const buildCodingRoadmapFallback = ({
  language,
  durationMonths,
  level,
  goal,
}) => {
  const totalWeeks = Math.max(durationMonths * 4, 4);
  const capitalizedLanguage =
    String(language || "Programming").charAt(0).toUpperCase() +
    String(language || "programming").slice(1);
  const normalizedGoal = String(goal || "").trim();
  const goalLine = normalizedGoal
    ? `Primary goal: ${normalizedGoal}`
    : "Primary goal: Build coding fundamentals and complete practical mini projects.";

  const weeklyLines = [];
  for (let week = 1; week <= totalWeeks; week += 1) {
    if (week === 1) {
      weeklyLines.push(
        `Week ${week}: Setup environment, syntax basics, variables, operators, and input/output in ${capitalizedLanguage}.`
      );
      continue;
    }
    if (week <= 2) {
      weeklyLines.push(
        `Week ${week}: Conditions, loops, and problem-solving with 20 easy exercises.`
      );
      continue;
    }
    if (week <= 4) {
      weeklyLines.push(
        `Week ${week}: Functions, arrays/strings, debugging practice, and one mini project.`
      );
      continue;
    }
    if (week <= 8) {
      weeklyLines.push(
        `Week ${week}: OOP concepts, data structures basics, and medium-level coding questions.`
      );
      continue;
    }
    weeklyLines.push(
      `Week ${week}: DSA practice, project polishing, mock interviews/tests, and revision notes.`
    );
  }

  return [
    `${capitalizedLanguage} ${durationMonths}-Month Roadmap`,
    `Level: ${level}`,
    goalLine,
    "",
    "Weekly Plan",
    ...weeklyLines,
    "",
    "Daily Routine (60-90 mins)",
    "- 20 mins concept learning",
    "- 30 mins coding practice",
    "- 10 mins error log and revision",
    "",
    "Milestones",
    "- Complete at least 2 mini projects",
    "- Solve 150+ coding questions",
    "- Build one final portfolio project",
  ].join("\n");
};

const normalizeExamType = (value) => {
  const normalized = String(value || "JEE").trim().toUpperCase();
  return EXAM_AUTO_ALLOWED_TYPES.has(normalized) ? normalized : "JEE";
};

const toExamSubjectLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "math") return "Mathematics";
  if (normalized === "chemistry") return "Chemistry";
  if (normalized === "physics") return "Physics";
  if (normalized === "biology") return "Biology";
  if (!normalized) return "General";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getExamAutoInsights = async ({ studentId, examType }) => {
  const examSubjects = EXAM_AUTO_SUBJECTS[examType] || EXAM_AUTO_SUBJECTS.JEE;
  const submissions = await Submission.find({ student: studentId })
    .populate("test", "subject title")
    .populate("answers.question", "topic correctAnswer")
    .sort({ submittedAt: -1 })
    .limit(80);

  const relevantSubmissions = submissions.filter((submission) =>
    examSubjects.includes(normalizeSubject(submission?.test?.subject))
  );

  const scopedSubmissions = relevantSubmissions.length
    ? relevantSubmissions
    : submissions;

  const subjectBuckets = {};
  const topicMistakes = {};
  let scoreSum = 0;

  for (const sub of scopedSubmissions) {
    const normalizedSubject = normalizeSubject(sub?.test?.subject || "general");
    const subject = examSubjects.includes(normalizedSubject)
      ? normalizedSubject
      : normalizedSubject || "general";

    const percentage = Number(sub?.percentage || 0);
    scoreSum += percentage;

    if (!subjectBuckets[subject]) {
      subjectBuckets[subject] = { attempts: 0, scoreSum: 0 };
    }
    subjectBuckets[subject].attempts += 1;
    subjectBuckets[subject].scoreSum += percentage;

    for (const answer of sub?.answers || []) {
      if (!answer?.question) continue;
      const selected = Number(answer.selected);
      const correct = Number(answer.question.correctAnswer);
      const hasSelection =
        answer.selected !== null &&
        answer.selected !== undefined &&
        String(answer.selected).trim() !== "";
      const isCorrect =
        hasSelection && Number.isFinite(selected) && selected === correct;

      if (!isCorrect) {
        const topic = toShortText(answer.question.topic || "General", 80) || "General";
        topicMistakes[topic] = (topicMistakes[topic] || 0) + 1;
      }
    }
  }

  const attempts = scopedSubmissions.length;
  const averageScore = attempts
    ? Number((scoreSum / attempts).toFixed(2))
    : 0;

  const subjectPerformance = Object.entries(subjectBuckets)
    .map(([subject, bucket]) => ({
      subject: toExamSubjectLabel(subject),
      avgScore: Number((bucket.scoreSum / Math.max(bucket.attempts, 1)).toFixed(2)),
      attempts: bucket.attempts,
    }))
    .sort((a, b) => a.avgScore - b.avgScore || b.attempts - a.attempts);

  let weakSubjects = subjectPerformance
    .filter((row) => row.avgScore < 65)
    .map((row) => row.subject);
  if (!weakSubjects.length) {
    weakSubjects = subjectPerformance.slice(0, 2).map((row) => row.subject);
  }
  if (!weakSubjects.length) {
    weakSubjects = examSubjects.slice(0, 2).map(toExamSubjectLabel);
  }

  const weakTopics = Object.entries(topicMistakes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic]) => topic);

  return {
    attempts,
    averageScore,
    weakSubjects,
    weakTopics,
    subjectPerformance,
    examSubjects: examSubjects.map(toExamSubjectLabel),
    relevantAttemptCount: relevantSubmissions.length,
    totalAttemptCount: submissions.length,
  };
};

const buildExamAutoPlanFallback = ({
  examType,
  durationMonths,
  dailyHours,
  goal,
  attempts,
  averageScore,
  weakSubjects,
  weakTopics,
}) => {
  const goalLine = goal
    ? `Target goal: ${goal}`
    : "Target goal: Build strong fundamentals, improve speed, and lift mock-test accuracy.";
  const subjectLine = weakSubjects.length
    ? weakSubjects.join(", ")
    : (EXAM_AUTO_SUBJECTS[examType] || EXAM_AUTO_SUBJECTS.JEE)
        .map(toExamSubjectLabel)
        .join(", ");
  const topicLine = weakTopics.length
    ? weakTopics.join(", ")
    : "Concept clarity, problem-solving speed, error analysis, and revision consistency";

  const monthLines = [];
  for (let month = 1; month <= durationMonths; month += 1) {
    if (month === 1) {
      monthLines.push(
        `Month ${month}: Foundation reset for ${subjectLine}, formula notebook setup, and PYQ orientation.`
      );
      continue;
    }
    if (month === durationMonths) {
      monthLines.push(
        `Month ${month}: Full syllabus revision cycles, high-frequency mock tests, and exam temperament control.`
      );
      continue;
    }
    monthLines.push(
      `Month ${month}: Chapter completion targets + weekly mocks + weak-topic recovery loops.`
    );
  }

  return [
    `${examType} Smart Prep (Auto Mode)`,
    `Duration: ${durationMonths} month(s) | Daily effort: ${dailyHours} hour(s)`,
    goalLine,
    "",
    "1) Auto Mode Strategy",
    `Use recent performance (${attempts} attempts, avg ${averageScore}%) to prioritize weak areas automatically.`,
    "",
    "2) Month-wise Milestones",
    ...monthLines,
    "",
    "3) Weekly Cycle (Mon-Sun)",
    "Mon-Tue: Concept blocks + targeted practice by weak subject.",
    "Wed-Thu: Timed drills + error-log correction.",
    "Fri: Chapter tests + formula/reactive revision.",
    "Sat: Full or half-length mock + deep analysis.",
    "Sun: Recovery + weak-topic micro-retest + next-week setup.",
    "",
    `4) Daily Time Blocks (${dailyHours}h/day)`,
    "- 30% concept learning and notes",
    "- 50% question practice (mixed difficulty)",
    "- 20% analysis, revision, and mistake tracking",
    "",
    "5) Weak-Topic Retest Engine",
    `Current weak focus: ${topicLine}`,
    "Run short re-tests after 48-72 hours for each weak chapter until accuracy crosses 70%.",
    "",
    "6) Mock Test + Analysis Loop",
    "At least 1 mock per week. For every mock, classify mistakes into concept gap, silly error, or time issue.",
    "",
    "7) Parent/Teacher Progress Signals",
    "Share weekly: mock score trend, top 3 weak chapters, and completion ratio of planned tasks.",
    "",
    "8) Next 7-Day Action Plan",
    `Complete 2 weak chapters from ${subjectLine}, solve 200+ mixed questions, and attempt one timed mock.`,
  ].join("\n");
};

const escapePdfTextLine = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "");

const wrapTextForPdf = (text, maxCharsPerLine = 95) => {
  const rawLines = String(text || "").replace(/\r/g, "").split("\n");
  const wrappedLines = [];

  for (const line of rawLines) {
    const safeLine = String(line || "");
    if (!safeLine.trim()) {
      wrappedLines.push("");
      continue;
    }

    if (safeLine.length <= maxCharsPerLine) {
      wrappedLines.push(safeLine);
      continue;
    }

    const words = safeLine.split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrappedLines.push(safeLine.slice(0, maxCharsPerLine));
      continue;
    }

    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }

      const next = `${current} ${word}`;
      if (next.length <= maxCharsPerLine) {
        current = next;
      } else {
        wrappedLines.push(current);
        current = word;
      }
    }

    if (current) wrappedLines.push(current);
  }

  return wrappedLines;
};

const buildPlainTextPdfBuffer = (text) => {
  const lines = wrapTextForPdf(text, 95);
  const linesPerPage = 48;
  const pages = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  if (!pages.length) pages.push(["No content"]);

  const maxObjectId = 3 + pages.length * 2;
  const objects = new Array(maxObjectId + 1).fill("");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  const pageObjectIds = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageObjectId = 4 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const contentOps = [
      "BT",
      "/F1 11 Tf",
      "14 TL",
      "50 780 Td",
    ];

    for (const line of pages[pageIndex]) {
      if (!line.trim()) {
        contentOps.push("T*");
      } else {
        contentOps.push(`(${escapePdfTextLine(line)}) Tj`);
        contentOps.push("T*");
      }
    }
    contentOps.push("ET");

    const stream = contentOps.join("\n");
    const streamLength = Buffer.byteLength(stream, "utf8");
    objects[contentObjectId] = `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = new Array(maxObjectId + 1).fill(0);
  for (let id = 1; id <= maxObjectId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${maxObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxObjectId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
};

const normalizeFileToken = (value, fallback = "roadmap") => {
  const token = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token || fallback;
};

const toShortText = (value, maxLength = CHAT_MESSAGE_MAX_LENGTH) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeChatMode = (role, rawMode) => {
  const normalized = String(rawMode || "").trim().toLowerCase();

  if (role === "student") {
    return STUDENT_CHAT_MODES.has(normalized) ? normalized : "quick_doubt";
  }
  if (role === "teacher") {
    return TEACHER_CHAT_MODES.has(normalized) ? normalized : "class_insights";
  }
  if (role === "parent") {
    return PARENT_CHAT_MODES.has(normalized) ? normalized : "daily_support";
  }
  return "quick_doubt";
};

const sanitizeChatHistory = (history) => {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => ({
      role:
        String(item?.role || "").toLowerCase() === "assistant"
          ? "assistant"
          : "user",
      content: toShortText(item?.content || ""),
    }))
    .filter((item) => item.content)
    .slice(-CHAT_HISTORY_MAX_TURNS);
};

const sanitizeSessionMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((item) => ({
      role:
        String(item?.role || "").toLowerCase() === "assistant"
          ? "assistant"
          : "user",
      text: toShortText(item?.text || "", CHAT_REPLY_MAX_LENGTH),
      source: toShortText(item?.source || "user", 20).toLowerCase(),
      createdAt: item?.createdAt ? new Date(item.createdAt) : new Date(),
    }))
    .filter((item) => item.text)
    .slice(-CHAT_SESSION_MAX_MESSAGES);
};

const toPromptHistoryFromSession = (sessionMessages) =>
  sanitizeSessionMessages(sessionMessages)
    .slice(-CHAT_HISTORY_MAX_TURNS)
    .map((item) => ({
      role: item.role,
      content: item.text,
    }));

const toClientMessages = (sessionMessages) =>
  sanitizeSessionMessages(sessionMessages)
    .slice(-CHAT_SESSION_RETURN_MESSAGES)
    .map((item) => ({
      role: item.role,
      text: item.text,
      source: item.source || "user",
      createdAt: new Date(item.createdAt).toISOString(),
    }));

const buildSessionQuery = ({ userId, role, mode, contextStudentId = null }) => ({
  user: userId,
  role,
  mode,
  contextStudent: contextStudentId || null,
});

const resolveParentTargetChild = async (parentId, requestedStudentId) => {
  const links = await ParentStudentLink.find({
    parentId,
    verified: true,
  }).populate("studentId", "name email");

  const children = links.map((link) => link.studentId).filter(Boolean);
  if (!children.length) {
    throw createHttpError(400, "No linked child found");
  }

  const normalizedRequested = String(requestedStudentId || "").trim();
  let targetChild = children[0];

  if (normalizedRequested) {
    targetChild = children.find(
      (child) => String(child._id) === normalizedRequested
    );
    if (!targetChild) {
      throw createHttpError(403, "Access denied");
    }
  }

  return {
    targetChild,
    children,
  };
};

const getSubmissionPercent = (submission) => {
  const fromPercent = Number(submission?.percentage);
  if (Number.isFinite(fromPercent)) return Number(fromPercent.toFixed(2));

  const score = Number(submission?.score) || 0;
  const totalMarks = Number(submission?.totalMarks) || 0;
  if (totalMarks <= 0) return 0;
  return Number(((score / totalMarks) * 100).toFixed(2));
};

const extractWeakTopicsFromSubmissions = (submissions, limit = 5) => {
  const mistakeCountByTopic = new Map();

  for (const submission of submissions || []) {
    for (const answer of submission.answers || []) {
      const question = answer?.question;
      if (!question) continue;

      const hasSelection =
        answer.selected !== null &&
        answer.selected !== undefined &&
        String(answer.selected).trim() !== "";
      const selected = Number(answer.selected);
      const correctAnswer = Number(question.correctAnswer);
      const isWrong =
        hasSelection &&
        Number.isFinite(selected) &&
        Number.isFinite(correctAnswer) &&
        selected !== correctAnswer;
      if (!isWrong) continue;

      const topic = String(question.topic || "General").trim() || "General";
      mistakeCountByTopic.set(topic, (mistakeCountByTopic.get(topic) || 0) + 1);
    }
  }

  return [...mistakeCountByTopic.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([topic, mistakes]) => ({ topic, mistakes }));
};

const getStudentPendingTestsCount = async (studentId) => {
  const enrollments = await Enrollment.find({ student: studentId }).select(
    "teacher subject"
  );
  if (!enrollments.length) return 0;

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
  const publishedTests = await Test.find({
    createdBy: { $in: teacherIds },
    isPublished: true,
  }).select("_id createdBy subject");

  const visibleTests = publishedTests.filter((test) => {
    const allowedSubjects = allowedByTeacher.get(String(test.createdBy));
    return allowedSubjects?.has(normalizeSubject(test.subject));
  });

  if (!visibleTests.length) return 0;

  const visibleTestIds = visibleTests.map((test) => test._id);
  const submitted = await Submission.find({
    student: studentId,
    test: { $in: visibleTestIds },
  }).select("test");

  const submittedTestIds = new Set(
    submitted.map((row) => String(row.test || ""))
  );
  return visibleTests.filter((test) => !submittedTestIds.has(String(test._id)))
    .length;
};

const buildStudentChatContext = async (studentId, mode) => {
  const submissions = await Submission.find({ student: studentId })
    .populate("test", "title subject")
    .populate("answers.question", "topic correctAnswer")
    .sort({ submittedAt: -1 })
    .limit(20);

  const recentSubmissions = submissions.slice(0, 5);
  const weakTopics = extractWeakTopicsFromSubmissions(submissions, 5);

  const attemptCount = submissions.length;
  const averageScore = attemptCount
    ? Number(
        (
          submissions.reduce((sum, row) => sum + getSubmissionPercent(row), 0) /
          attemptCount
        ).toFixed(2)
      )
    : 0;
  const recentAverage = recentSubmissions.length
    ? Number(
        (
          recentSubmissions.reduce(
            (sum, row) => sum + getSubmissionPercent(row),
            0
          ) / recentSubmissions.length
        ).toFixed(2)
      )
    : 0;
  const bestScore = attemptCount
    ? Number(
        Math.max(...submissions.map((row) => getSubmissionPercent(row))).toFixed(2)
      )
    : 0;
  const pendingTests = await getStudentPendingTestsCount(studentId);
  const dailySummary = await getStudentDailySummary(studentId);

  return {
    promptContext: {
      role: "student",
      mode,
      attempts: attemptCount,
      averageScore,
      recentAverage,
      bestScore,
      pendingTests,
      todayAttendance: dailySummary?.attendance || "Unknown",
      weakTopics,
      recentTests: recentSubmissions.map((row) => ({
        title: row.test?.title || "Untitled",
        subject: row.test?.subject || "general",
        percentage: getSubmissionPercent(row),
        submittedAt: row.submittedAt
          ? new Date(row.submittedAt).toISOString()
          : null,
      })),
    },
    responseContext: {
      weakTopics,
      todayAttendance: dailySummary?.attendance || "Unknown",
    },
  };
};

const buildTeacherChatContext = async (teacherId, mode) => {
  const tests = await Test.find({ createdBy: teacherId }).select(
    "_id title subject isPublished"
  );
  const testIds = tests.map((test) => test._id);
  const enrollments = await Enrollment.find({ teacher: teacherId }).select(
    "student subject"
  );

  let submissions = [];
  if (testIds.length > 0) {
    submissions = await Submission.find({
      test: { $in: testIds },
    })
      .select("student score totalMarks percentage test answers submittedAt")
      .populate("test", "title subject")
      .populate("answers.question", "topic correctAnswer");
  }

  const studentsAttempted = new Set(
    submissions.map((row) => String(row.student || "")).filter(Boolean)
  ).size;
  const classAverage = submissions.length
    ? Number(
        (
          submissions.reduce((sum, row) => sum + getSubmissionPercent(row), 0) /
          submissions.length
        ).toFixed(2)
      )
    : 0;

  const weakTopics = extractWeakTopicsFromSubmissions(submissions, 6);
  const byTest = new Map();
  submissions.forEach((row) => {
    const key = String(row.test?._id || row.test || "");
    const current = byTest.get(key) || {
      title: row.test?.title || "Untitled",
      subject: row.test?.subject || "general",
      attempts: 0,
      sum: 0,
    };
    current.attempts += 1;
    current.sum += getSubmissionPercent(row);
    byTest.set(key, current);
  });

  const lowPerformingTests = [...byTest.values()]
    .map((row) => ({
      title: row.title,
      subject: row.subject,
      attempts: row.attempts,
      averagePercent: Number((row.sum / Math.max(row.attempts, 1)).toFixed(2)),
    }))
    .sort((a, b) => a.averagePercent - b.averagePercent || b.attempts - a.attempts)
    .slice(0, 3);

  const connectedStudents = new Set(
    enrollments.map((row) => String(row.student || "")).filter(Boolean)
  ).size;
  const subjectSet = new Set(
    enrollments.map((row) => String(row.subject || "").trim()).filter(Boolean)
  );

  return {
    promptContext: {
      role: "teacher",
      mode,
      stats: {
        testsCreated: tests.length,
        publishedTests: tests.filter((test) => test.isPublished).length,
        connectedStudents,
        studentsAttempted,
        classAverage,
      },
      subjects: [...subjectSet],
      weakTopics,
      lowPerformingTests,
    },
    responseContext: {
      weakTopics,
      classAverage,
    },
  };
};

const buildParentChatContext = async (parentId, mode, requestedStudentId) => {
  const { targetChild, children } = await resolveParentTargetChild(
    parentId,
    requestedStudentId
  );

  const studentId = targetChild._id;
  const submissions = await Submission.find({ student: studentId })
    .populate("test", "title subject")
    .populate("answers.question", "topic correctAnswer")
    .sort({ submittedAt: -1 })
    .limit(12);
  const recentSubmissions = submissions.slice(0, 5);
  const weakTopics = extractWeakTopicsFromSubmissions(submissions, 5);
  const averageScore = submissions.length
    ? Number(
        (
          submissions.reduce((sum, row) => sum + getSubmissionPercent(row), 0) /
          submissions.length
        ).toFixed(2)
      )
    : 0;
  const dailySummary = await getStudentDailySummary(studentId);

  return {
    promptContext: {
      role: "parent",
      mode,
      child: {
        id: String(targetChild._id),
        name: targetChild.name || "Student",
      },
      stats: {
        averageScore,
        attempts: submissions.length,
        attendanceToday: dailySummary?.attendance || "Unknown",
      },
      weakTopics,
      recentTests: recentSubmissions.map((row) => ({
        title: row.test?.title || "Untitled",
        subject: row.test?.subject || "general",
        percentage: getSubmissionPercent(row),
        submittedAt: row.submittedAt
          ? new Date(row.submittedAt).toISOString()
          : null,
      })),
      linkedChildren: children.map((child) => ({
        id: String(child._id),
        name: child.name || "Student",
      })),
    },
    responseContext: {
      targetStudentId: String(targetChild._id),
      targetStudentName: targetChild.name || "Student",
      weakTopics,
      attendanceToday: dailySummary?.attendance || "Unknown",
    },
  };
};

const buildRoleAwareChatPrompt = ({
  role,
  mode,
  message,
  history,
  promptContext,
}) => {
  const roleInstruction =
    role === "student"
      ? [
          "You are EduNesta Study Buddy for a student.",
          "Teach concept-first and keep explanations simple.",
          "If the user asks for direct live-exam answers, refuse politely and give hints/steps instead.",
          "Always end with a short concrete next action.",
        ].join("\n")
      : role === "teacher"
      ? [
          "You are EduNesta Teaching Assistant for a teacher.",
          "Focus on class interventions, weak-topic strategy, and actionable classroom plans.",
          "Be concise, practical, and data-driven.",
        ].join("\n")
      : [
          "You are EduNesta Guardian Assistant for a parent.",
          "Use plain language and give practical daily/weekly steps.",
          "Do not expose internal system details or unrelated student data.",
        ].join("\n");

  const historyText = history.length
    ? history
        .map(
          (item) =>
            `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`
        )
        .join("\n")
    : "No previous conversation.";

  return `
${roleInstruction}

Chat mode: ${mode}

Context data (trusted app data):
${JSON.stringify(promptContext, null, 2)}

Conversation history:
${historyText}

Current user message:
${message}

Response format rules:
- Keep response under 180 words.
- Use short bullet points when useful.
- Do not hallucinate unavailable data.
- If confidence is low, say what is missing and suggest one next action.
`.trim();
};

const buildRoleFallbackReply = ({ role, mode, context }) => {
  if (role === "student") {
    const weakTopics = (context?.weakTopics || [])
      .slice(0, 3)
      .map((row) => row.topic);
    return [
      "AI is temporarily unavailable. Quick guidance:",
      `- Focus mode: ${mode.replaceAll("_", " ")}.`,
      `- Today's attendance: ${context?.todayAttendance || "Unknown"}.`,
      `- Priority topics: ${
        weakTopics.length ? weakTopics.join(", ") : "Revise recent mistakes"
      }.`,
      "- Do one 20-minute focused revision block and then attempt 5 practice questions.",
    ].join("\n");
  }

  if (role === "teacher") {
    const weakTopics = (context?.weakTopics || [])
      .slice(0, 3)
      .map((row) => row.topic);
    return [
      "AI is temporarily unavailable. Quick class intervention plan:",
      `- Class average baseline: ${context?.classAverage ?? 0}%.`,
      `- Top weak topics: ${
        weakTopics.length ? weakTopics.join(", ") : "No clear trend yet"
      }.`,
      "- Run a 15-minute concept recap and then a 10-question mini diagnostic.",
      "- Group students by weak topic and assign targeted practice sets.",
    ].join("\n");
  }

  const weakTopics = (context?.weakTopics || [])
    .slice(0, 3)
    .map((row) => row.topic);
  return [
    "AI is temporarily unavailable. Quick parent action plan:",
    `- Child: ${context?.targetStudentName || "Student"}.`,
    `- Today's attendance: ${context?.attendanceToday || "Unknown"}.`,
    `- Topics to focus: ${
      weakTopics.length ? weakTopics.join(", ") : "General revision"
    }.`,
    "- Ask for one 20-minute study session today and review one weak topic together.",
  ].join("\n");
};

const clipReply = (value) => toShortText(value, CHAT_REPLY_MAX_LENGTH);

const loadStudyBuddySession = async ({
  userId,
  role,
  mode,
  contextStudentId = null,
}) =>
  StudyBuddySession.findOne(
    buildSessionQuery({ userId, role, mode, contextStudentId })
  );

const saveStudyBuddyExchange = async ({
  userId,
  role,
  mode,
  contextStudentId = null,
  userMessage,
  assistantMessage,
  assistantSource = "ai",
}) => {
  const query = buildSessionQuery({ userId, role, mode, contextStudentId });
  const existing = await StudyBuddySession.findOne(query);

  const baseMessages = sanitizeSessionMessages(existing?.messages || []);
  const nextMessages = sanitizeSessionMessages([
    ...baseMessages,
    {
      role: "user",
      text: toShortText(userMessage, CHAT_MESSAGE_MAX_LENGTH),
      source: "user",
      createdAt: new Date(),
    },
    {
      role: "assistant",
      text: clipReply(assistantMessage),
      source: assistantSource,
      createdAt: new Date(),
    },
  ]);

  let sessionDoc = existing;
  if (!sessionDoc) {
    sessionDoc = new StudyBuddySession({
      user: userId,
      role,
      mode,
      contextStudent: contextStudentId || null,
      messages: [],
      lastMessageAt: new Date(),
    });
  }

  sessionDoc.messages = nextMessages;
  sessionDoc.lastMessageAt = new Date();
  try {
    await sessionDoc.save();
  } catch (error) {
    if (error?.code === 11000) {
      // Retry once if a competing request created the same unique session key.
      return saveStudyBuddyExchange({
        userId,
        role,
        mode,
        contextStudentId,
        userMessage,
        assistantMessage,
        assistantSource,
      });
    }
    throw error;
  }

  return sessionDoc;
};

const resolveChatContextForRole = async ({ req, role, mode }) => {
  if (role === "student") {
    const context = await buildStudentChatContext(req.user._id, mode);
    return {
      contextBundle: context,
      contextStudentId: null,
    };
  }
  if (role === "teacher") {
    const context = await buildTeacherChatContext(req.user._id, mode);
    return {
      contextBundle: context,
      contextStudentId: null,
    };
  }

  const requestedStudentId = req.body?.studentId ?? req.query?.studentId;
  const context = await buildParentChatContext(req.user._id, mode, requestedStudentId);
  return {
    contextBundle: context,
    contextStudentId: context?.responseContext?.targetStudentId || null,
  };
};

/* ----------------------------------
   1) AI Question Quality Checker
-----------------------------------*/
export const reviewQuestion = async (req, res) => {
  try {
    const { question, options, correctAnswer, topic } = req.body || {};

    if (!question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        message: "question and at least two options are required",
      });
    }

    const prompt = `
You are an exam paper reviewer.

Analyze this MCQ carefully.

Question: ${question}
Options: ${options.join(", ")}
Correct Answer: ${
      Array.isArray(correctAnswer) ? correctAnswer.join(", ") : correctAnswer
    }
Topic: ${topic}

Return ONLY valid JSON:
{
  "difficulty": "Easy | Medium | Hard",
  "clarityScore": 1,
  "issues": [],
  "improvementSuggestions": []
}
`;

    try {
      const aiText = await askGemini(prompt);
      const parsed = parseReviewFromText(aiText);

      if (!parsed) {
        throw new AIServiceError("AI response format invalid.", {
          statusCode: 502,
          code: "AI_BAD_RESPONSE",
        });
      }

      return res.json({
        success: true,
        source: "ai",
        review: parsed,
      });
    } catch (error) {
      const fallbackReview = buildQuestionFallbackReview({
        question,
        options,
        correctAnswer,
        topic,
      });

      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            review: fallbackReview,
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("AI Question Review Error:", err);
    return res.status(500).json({
      success: false,
      error: "AI service unavailable",
    });
  }
};

/* ----------------------------------
   2) AI MCQ Generation From Paragraph
-----------------------------------*/
export const generateMcqFromParagraph = async (req, res) => {
  try {
    const paragraph = sanitizeParagraphInput(req.body?.paragraph);
    const topic = toShortText(req.body?.topic || "Comprehension", 120);
    const minClarityScore = Number(process.env.AI_MIN_CLARITY_SCORE || 5);
    const count = clampInt(
      req.body?.count,
      AUTO_MCQ_MIN_COUNT,
      AUTO_MCQ_MAX_COUNT,
      AUTO_MCQ_DEFAULT_COUNT
    );
    const marks = clampInt(req.body?.marks, 1, 100, 1);

    if (paragraph.length < AUTO_MCQ_MIN_PARAGRAPH_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `paragraph must be at least ${AUTO_MCQ_MIN_PARAGRAPH_LENGTH} characters`,
      });
    }

    const prompt = `
You are an expert exam setter.
Generate ${count} MCQs from the paragraph below.

Rules:
- Each question must come from paragraph content.
- Keep one clearly correct answer.
- Provide 4 options per question.
- Use short, clear wording.

Return ONLY valid JSON in this exact shape:
{
  "questions": [
    {
      "text": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": 0,
      "topic": "${topic}",
      "marks": ${marks},
      "aiReview": {
        "difficulty": "Easy | Medium | Hard",
        "clarityScore": 1,
        "issues": [],
        "improvementSuggestions": []
      }
    }
  ]
}

Paragraph:
${paragraph}
`;

    try {
      const aiText = await askGemini(prompt);
      const parsedRows = parseGeneratedQuestionsFromText(aiText);
      const normalizedQuestions = parsedRows
        .map((row) =>
          normalizeGeneratedQuestion({
            row,
            fallbackTopic: topic,
            minClarityScore,
            defaultMarks: marks,
          })
        )
        .filter(Boolean);

      const fallbackQuestions = buildParagraphFallbackQuestions({
        paragraph,
        count,
        topic,
        minClarityScore,
        defaultMarks: marks,
      });
      while (
        normalizedQuestions.length < count &&
        fallbackQuestions[normalizedQuestions.length]
      ) {
        normalizedQuestions.push(fallbackQuestions[normalizedQuestions.length]);
      }

      if (!normalizedQuestions.length) {
        throw new AIServiceError("AI response format invalid.", {
          statusCode: 502,
          code: "AI_BAD_RESPONSE",
        });
      }

      return res.json({
        success: true,
        source: "ai",
        requestedCount: count,
        questionCount: Math.min(normalizedQuestions.length, count),
        questions: normalizedQuestions.slice(0, count),
      });
    } catch (error) {
      const fallbackQuestions = buildParagraphFallbackQuestions({
        paragraph,
        count,
        topic,
        minClarityScore,
        defaultMarks: marks,
      });

      if (!fallbackQuestions.length) {
        throw error;
      }

      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            requestedCount: count,
            questionCount: fallbackQuestions.length,
            questions: fallbackQuestions,
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("AI MCQ Generation Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate MCQs from paragraph",
    });
  }
};

export const generateMcqFromPdf = async (req, res) => {
  try {
    if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        message: "PDF file is required",
      });
    }

    const paragraph = (() => {
      try {
        return req.file ? req.file.buffer : null;
      } catch {
        return null;
      }
    })();

    if (!paragraph) {
      return res.status(400).json({
        success: false,
        message: "Invalid PDF upload",
      });
    }
    if (!isPdfSignatureValid(paragraph)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PDF file signature",
      });
    }

    const minClarityScore = Number(process.env.AI_MIN_CLARITY_SCORE || 5);
    const count = clampInt(
      req.body?.count,
      AUTO_MCQ_MIN_COUNT,
      AUTO_MCQ_MAX_COUNT,
      AUTO_MCQ_DEFAULT_COUNT
    );
    const marks = clampInt(req.body?.marks, 1, 100, 1);
    const inferredTopic = inferTopicFromFilename(req.file?.originalname);
    const topic = toShortText(
      req.body?.topic || req.body?.subject || inferredTopic || "Syllabus",
      120
    );

    let extractedText = "";
    try {
      const parsed = await pdfParse(paragraph);
      extractedText = sanitizePdfExtractedText(parsed?.text || "");
    } catch (error) {
      console.error("AI MCQ PDF parse error:", error);
      return res.status(400).json({
        success: false,
        message: "Could not read text from the uploaded PDF",
      });
    }

    if (extractedText.length < AUTO_MCQ_MIN_PARAGRAPH_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Could not extract enough text from PDF. Minimum ${AUTO_MCQ_MIN_PARAGRAPH_LENGTH} characters required.`,
      });
    }

    const prompt = `
You are an expert exam setter.
Generate ${count} MCQs from the syllabus text below.

Rules:
- Each question must come from syllabus text content.
- Keep one clearly correct answer.
- Provide 4 options per question.
- Use short, clear wording.

Return ONLY valid JSON in this exact shape:
{
  "questions": [
    {
      "text": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": 0,
      "topic": "${topic}",
      "marks": ${marks},
      "aiReview": {
        "difficulty": "Easy | Medium | Hard",
        "clarityScore": 1,
        "issues": [],
        "improvementSuggestions": []
      }
    }
  ]
}

Syllabus Text:
${extractedText}
`;

    try {
      const aiText = await askGemini(prompt);
      const parsedRows = parseGeneratedQuestionsFromText(aiText);
      const normalizedQuestions = parsedRows
        .map((row) =>
          normalizeGeneratedQuestion({
            row,
            fallbackTopic: topic,
            minClarityScore,
            defaultMarks: marks,
          })
        )
        .filter(Boolean);

      const fallbackQuestions = buildParagraphFallbackQuestions({
        paragraph: extractedText,
        count,
        topic,
        minClarityScore,
        defaultMarks: marks,
      });
      while (
        normalizedQuestions.length < count &&
        fallbackQuestions[normalizedQuestions.length]
      ) {
        normalizedQuestions.push(fallbackQuestions[normalizedQuestions.length]);
      }

      if (!normalizedQuestions.length) {
        throw new AIServiceError("AI response format invalid.", {
          statusCode: 502,
          code: "AI_BAD_RESPONSE",
        });
      }

      return res.json({
        success: true,
        source: "ai",
        requestedCount: count,
        questionCount: Math.min(normalizedQuestions.length, count),
        extractedChars: extractedText.length,
        questions: normalizedQuestions.slice(0, count),
      });
    } catch (error) {
      const fallbackQuestions = buildParagraphFallbackQuestions({
        paragraph: extractedText,
        count,
        topic,
        minClarityScore,
        defaultMarks: marks,
      });

      if (!fallbackQuestions.length) {
        throw error;
      }

      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            requestedCount: count,
            questionCount: fallbackQuestions.length,
            extractedChars: extractedText.length,
            questions: fallbackQuestions,
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("AI PDF MCQ Generation Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate MCQs from PDF",
    });
  }
};

/* ----------------------------------
   3) AI Weak Topic Summary
-----------------------------------*/
export const weakTopicSummary = async (req, res) => {
  try {
    let studentId = req.body.studentId;

    if (req.user.role === "student") {
      studentId = req.user._id;
    } else if (req.user.role === "parent") {
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: "studentId is required",
        });
      }

      const link = await ParentStudentLink.findOne({
        parentId: req.user._id,
        studentId,
        verified: true,
      });

      if (!link) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }
    } else if (req.user.role === "admin") {
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: "studentId is required",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const submissions = await Submission.find({ student: studentId }).populate(
      "answers.question"
    );

    const weakTopics = {};

    submissions.forEach((sub) => {
      sub.answers.forEach((ans) => {
        if (!ans.question) return;

        if (ans.selected !== ans.question.correctAnswer) {
          const topic = ans.question.topic || "General";
          weakTopics[topic] = (weakTopics[topic] || 0) + 1;
        }
      });
    });

    const prompt = `
You are a personal tutor.

Student is weak in these topics:
${JSON.stringify(weakTopics)}

Explain simply.
Mention common mistakes.
Give 3 revision tips per topic.
`;

    try {
      const summary = await askGemini(prompt);
      return res.json({
        success: true,
        source: "ai",
        summary,
      });
    } catch (error) {
      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            summary: buildWeakTopicFallbackSummary(weakTopics),
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("Weak Topic Error:", err);
    return res.status(500).json({
      success: false,
      error: "AI service unavailable",
    });
  }
};

/* ----------------------------------
   4) AI Next-Step Suggestions
-----------------------------------*/
export const nextStepSuggestions = async (req, res) => {
  try {
    const { stats } = req.body || {};

    const prompt = `
You are an academic mentor.

Student stats:
${JSON.stringify(stats)}

Suggest:
- What to study next
- Difficulty focus
- Practice strategy
- Motivation tip
`;

    try {
      const suggestions = await askGemini(prompt);
      return res.json({
        success: true,
        source: "ai",
        suggestions,
      });
    } catch (error) {
      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            suggestions: buildNextStepsFallback(stats || {}),
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("Next Steps Error:", err);
    return res.status(500).json({
      success: false,
      error: "AI service unavailable",
    });
  }
};

/* ----------------------------------
   5) AI Coding Roadmap
-----------------------------------*/
export const generateCodingRoadmap = async (req, res) => {
  try {
    const studentId = req.user?._id || req.user?.id;
    const language = toShortText(req.body?.language || "", 50);
    if (language.length < 2) {
      return res.status(400).json({
        success: false,
        error: "language is required",
      });
    }

    const durationMonths = clampInt(
      req.body?.durationMonths,
      ROADMAP_MIN_MONTHS,
      ROADMAP_MAX_MONTHS,
      ROADMAP_DEFAULT_MONTHS
    );
    const rawLevel = String(req.body?.level || "beginner").trim().toLowerCase();
    const level = ROADMAP_ALLOWED_LEVELS.has(rawLevel) ? rawLevel : "beginner";
    const goal = toShortText(req.body?.goal || "", 240);
    const totalWeeks = Math.max(durationMonths * 4, 4);

    const prompt = `
You are a senior programming mentor.
Create a practical learning roadmap for a student.

Inputs:
- Language: ${language}
- Duration: ${durationMonths} month(s)
- Level: ${level}
- Goal: ${goal || "General mastery with project-based practice"}

Requirements:
- Make it realistic for school/college students.
- Cover week-by-week progression for ${totalWeeks} weeks.
- Include concepts, coding practice targets, and project milestones.
- Include revision and mock interview/test practice near the end.

Return plain text using this structure:
1) Outcome Goal
2) Week-by-Week Plan
3) Project Milestones
4) Daily/Weekly Routine
5) Recommended Resource Types
6) Common Mistakes to Avoid
7) Final Readiness Checklist
`;

    try {
      const planText = await askGemini(prompt);
      const savedRoadmap = await CodingRoadmap.create({
        student: studentId,
        language,
        durationMonths,
        level,
        goal,
        planText,
        source: "ai",
      });

      return res.json({
        success: true,
        source: "ai",
        roadmap: savedRoadmap,
      });
    } catch (error) {
      const fallbackPlanText = buildCodingRoadmapFallback({
        language,
        durationMonths,
        level,
        goal,
      });

      const aiMeta = getAiMeta(error);
      const savedRoadmap = await CodingRoadmap.create({
        student: studentId,
        language,
        durationMonths,
        level,
        goal,
        planText: fallbackPlanText,
        source: "fallback",
        aiStatus: aiMeta.code,
        warning: aiMeta.warning,
      });

      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            roadmap: savedRoadmap,
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("Coding Roadmap Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate coding roadmap",
    });
  }
};

export const getCodingRoadmapHistory = async (req, res) => {
  try {
    const studentId = req.user?._id || req.user?.id;
    const limit = clampInt(
      req.query?.limit,
      1,
      ROADMAP_HISTORY_MAX_LIMIT,
      ROADMAP_HISTORY_DEFAULT_LIMIT
    );

    const history = await CodingRoadmap.find({
      student: studentId,
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      history,
    });
  } catch (err) {
    console.error("Coding Roadmap History Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch coding roadmap history",
    });
  }
};

export const downloadCodingRoadmapPdf = async (req, res) => {
  try {
    const studentId = req.user?._id || req.user?.id;
    const roadmapId = String(req.params?.id || "").trim();

    if (!/^[0-9a-fA-F]{24}$/.test(roadmapId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid roadmap ID",
      });
    }

    const roadmap = await CodingRoadmap.findOne({
      _id: roadmapId,
      student: studentId,
    });
    if (!roadmap) {
      return res.status(404).json({
        success: false,
        error: "Roadmap not found",
      });
    }

    const title = `${roadmap.language} ${roadmap.durationMonths}-Month Roadmap`;
    const exportedAt = new Date().toISOString();
    const content = [
      "EduNesta Coding Roadmap",
      "",
      `Title: ${title}`,
      `Level: ${roadmap.level}`,
      `Goal: ${roadmap.goal || "-"}`,
      `Generated: ${new Date(roadmap.createdAt).toISOString()}`,
      `Exported: ${exportedAt}`,
      "",
      String(roadmap.planText || ""),
    ].join("\n");

    const pdfBuffer = buildPlainTextPdfBuffer(content);
    const languageToken = normalizeFileToken(roadmap.language, "coding");
    const filename = `${languageToken}-roadmap-${roadmap.durationMonths}m.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Coding Roadmap PDF Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to download coding roadmap PDF",
    });
  }
};

export const generateExamAutoPlan = async (req, res) => {
  try {
    const studentId = req.user?._id || req.user?.id;
    const examType = normalizeExamType(req.body?.examType);
    const durationMonths = clampInt(
      req.body?.durationMonths,
      EXAM_AUTO_MIN_MONTHS,
      EXAM_AUTO_MAX_MONTHS,
      EXAM_AUTO_DEFAULT_MONTHS
    );
    const dailyHours = clampInt(
      req.body?.dailyHours,
      EXAM_AUTO_MIN_DAILY_HOURS,
      EXAM_AUTO_MAX_DAILY_HOURS,
      EXAM_AUTO_DEFAULT_DAILY_HOURS
    );
    const goal = toShortText(req.body?.goal || "", 240);
    const totalWeeks = Math.max(durationMonths * 4, 4);
    const insights = await getExamAutoInsights({
      studentId,
      examType,
    });

    const prompt = `
You are an expert ${examType} exam coach.
Create a practical "Auto Mode" preparation plan that updates from student performance.

Student inputs:
- Exam: ${examType}
- Duration: ${durationMonths} month(s)
- Daily Study Time: ${dailyHours} hour(s)
- Goal: ${goal || "Improve consistency, speed, and final exam readiness"}

Performance signals:
- Attempts considered for this exam: ${insights.attempts}
- Overall average score: ${insights.averageScore}%
- Weak subjects: ${JSON.stringify(insights.weakSubjects)}
- Weak topics: ${JSON.stringify(insights.weakTopics)}
- Subject performance: ${JSON.stringify(insights.subjectPerformance)}

Requirements:
- Make it realistic for school/college students.
- Use a week-by-week structure for ${totalWeeks} weeks.
- Include weak-topic 5-question micro-retest logic.
- Include mock test schedule and post-mock error analysis loop.
- Include a clear tracker for student, teacher, and parent dashboards.

Return plain text with this exact structure:
1) Auto Mode Strategy
2) Month-wise Milestones
3) Weekly Cycle (Mon-Sun)
4) Daily Time Blocks
5) Weak-Topic Retest Engine
6) Mock Test + Analysis Loop
7) Parent/Teacher Progress Signals
8) Next 7-Day Action Plan
`;

    try {
      const planText = await askGemini(prompt);
      const savedPlan = await ExamAutoPlan.create({
        student: studentId,
        examType,
        durationMonths,
        dailyHours,
        goal,
        summaryAttempts: insights.attempts,
        summaryAverageScore: insights.averageScore,
        weakSubjects: insights.weakSubjects,
        weakTopics: insights.weakTopics,
        planText,
        source: "ai",
      });

      return res.json({
        success: true,
        source: "ai",
        plan: savedPlan,
      });
    } catch (error) {
      const fallbackPlanText = buildExamAutoPlanFallback({
        examType,
        durationMonths,
        dailyHours,
        goal,
        attempts: insights.attempts,
        averageScore: insights.averageScore,
        weakSubjects: insights.weakSubjects,
        weakTopics: insights.weakTopics,
      });
      const aiMeta = getAiMeta(error);
      const savedPlan = await ExamAutoPlan.create({
        student: studentId,
        examType,
        durationMonths,
        dailyHours,
        goal,
        summaryAttempts: insights.attempts,
        summaryAverageScore: insights.averageScore,
        weakSubjects: insights.weakSubjects,
        weakTopics: insights.weakTopics,
        planText: fallbackPlanText,
        source: "fallback",
        aiStatus: aiMeta.code,
        warning: aiMeta.warning,
      });

      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            plan: savedPlan,
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("Exam Auto Plan Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate exam auto plan",
    });
  }
};

export const getExamAutoPlanHistory = async (req, res) => {
  try {
    const studentId = req.user?._id || req.user?.id;
    const limit = clampInt(
      req.query?.limit,
      1,
      EXAM_AUTO_HISTORY_MAX_LIMIT,
      EXAM_AUTO_HISTORY_DEFAULT_LIMIT
    );

    const history = await ExamAutoPlan.find({ student: studentId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      history,
    });
  } catch (err) {
    console.error("Exam Auto Plan History Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch exam auto plan history",
    });
  }
};

export const downloadExamAutoPlanPdf = async (req, res) => {
  try {
    const studentId = req.user?._id || req.user?.id;
    const planId = String(req.params?.id || "").trim();

    if (!/^[0-9a-fA-F]{24}$/.test(planId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid plan ID",
      });
    }

    const plan = await ExamAutoPlan.findOne({
      _id: planId,
      student: studentId,
    });
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Plan not found",
      });
    }

    const exportedAt = new Date().toISOString();
    const content = [
      `EduNesta ${plan.examType} Smart Prep (Auto Mode)`,
      "",
      `Exam: ${plan.examType}`,
      `Duration: ${plan.durationMonths} month(s)`,
      `Daily Hours: ${plan.dailyHours}`,
      `Goal: ${plan.goal || "-"}`,
      `Performance Snapshot: Attempts ${plan.summaryAttempts || 0}, Avg ${
        plan.summaryAverageScore || 0
      }%`,
      `Weak Subjects: ${(plan.weakSubjects || []).join(", ") || "-"}`,
      `Weak Topics: ${(plan.weakTopics || []).join(", ") || "-"}`,
      `Generated: ${new Date(plan.createdAt).toISOString()}`,
      `Exported: ${exportedAt}`,
      "",
      String(plan.planText || ""),
    ].join("\n");

    const pdfBuffer = buildPlainTextPdfBuffer(content);
    const examToken = normalizeFileToken(plan.examType, "exam");
    const filename = `${examToken}-auto-plan-${plan.durationMonths}m.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Exam Auto Plan PDF Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to download exam auto plan PDF",
    });
  }
};

export const getTeacherExamAutoPlanOverview = async (req, res) => {
  try {
    const teacherId = req.user?._id || req.user?.id;

    const enrollments = await Enrollment.find({ teacher: teacherId }).populate(
      "student",
      "name email"
    );

    const studentMap = new Map();
    for (const enrollment of enrollments) {
      const student = enrollment?.student;
      if (!student?._id) continue;
      const key = String(student._id);
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          id: key,
          name: student.name || "Student",
          email: student.email || "",
          subjects: new Set(),
        });
      }
      const subject = toExamSubjectLabel(enrollment.subject);
      studentMap.get(key).subjects.add(subject);
    }

    const studentIds = [...studentMap.keys()];
    if (!studentIds.length) {
      return res.json({
        success: true,
        stats: {
          connectedStudents: 0,
          studentsWithPlans: 0,
          avgPlanScore: 0,
          jeePlans: 0,
          neetPlans: 0,
        },
        students: [],
      });
    }

    const plans = await ExamAutoPlan.find({
      student: { $in: studentIds },
    }).sort({ createdAt: -1 });

    const latestPlanByStudent = new Map();
    const planCountByStudent = new Map();
    for (const plan of plans) {
      const key = String(plan.student);
      if (!latestPlanByStudent.has(key)) {
        latestPlanByStudent.set(key, plan);
      }
      planCountByStudent.set(key, (planCountByStudent.get(key) || 0) + 1);
    }

    let jeePlans = 0;
    let neetPlans = 0;
    let scoreSum = 0;
    let scoredCount = 0;

    const students = studentIds
      .map((studentId) => {
        const student = studentMap.get(studentId);
        const latestPlan = latestPlanByStudent.get(studentId) || null;
        if (latestPlan?.examType === "JEE") jeePlans += 1;
        if (latestPlan?.examType === "NEET") neetPlans += 1;
        if (Number.isFinite(Number(latestPlan?.summaryAverageScore))) {
          scoreSum += Number(latestPlan.summaryAverageScore);
          scoredCount += 1;
        }

        return {
          studentId,
          name: student?.name || "Student",
          email: student?.email || "",
          subjects: [...(student?.subjects || [])].sort((a, b) =>
            a.localeCompare(b)
          ),
          planCount: planCountByStudent.get(studentId) || 0,
          latestPlan: latestPlan
            ? {
                _id: latestPlan._id,
                examType: latestPlan.examType,
                durationMonths: latestPlan.durationMonths,
                dailyHours: latestPlan.dailyHours,
                summaryAverageScore: latestPlan.summaryAverageScore,
                weakSubjects: latestPlan.weakSubjects || [],
                weakTopics: latestPlan.weakTopics || [],
                source: latestPlan.source,
                warning: latestPlan.warning || "",
                createdAt: latestPlan.createdAt,
              }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      success: true,
      stats: {
        connectedStudents: studentIds.length,
        studentsWithPlans: students.filter((item) => item.latestPlan).length,
        avgPlanScore: scoredCount ? Number((scoreSum / scoredCount).toFixed(2)) : 0,
        jeePlans,
        neetPlans,
      },
      students,
    });
  } catch (err) {
    console.error("Teacher Exam Auto Plan Overview Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch teacher exam prep overview",
    });
  }
};

export const getParentExamAutoPlanOverview = async (req, res) => {
  try {
    const parentId = req.user?._id || req.user?.id;
    const requestedStudentId = String(req.query?.studentId || "").trim();

    const links = await ParentStudentLink.find({
      parentId,
      verified: true,
    }).populate("studentId", "name email");

    const linkedChildren = links
      .map((link) => link.studentId)
      .filter((child) => child?._id);

    if (!linkedChildren.length) {
      return res.json({
        success: true,
        children: [],
        selectedStudentId: "",
        selectedStudent: null,
        weeklySummary: null,
        history: [],
      });
    }

    const selectedChild = requestedStudentId
      ? linkedChildren.find(
          (child) => String(child._id) === requestedStudentId
        ) || linkedChildren[0]
      : linkedChildren[0];

    const selectedStudentId = String(selectedChild._id);
    const linkedIds = linkedChildren.map((child) => String(child._id));

    const allPlans = await ExamAutoPlan.find({
      student: { $in: linkedIds },
    }).sort({ createdAt: -1 });

    const latestByStudent = new Map();
    const countByStudent = new Map();
    for (const plan of allPlans) {
      const key = String(plan.student);
      if (!latestByStudent.has(key)) {
        latestByStudent.set(key, plan);
      }
      countByStudent.set(key, (countByStudent.get(key) || 0) + 1);
    }

    const history = allPlans
      .filter((plan) => String(plan.student) === selectedStudentId)
      .slice(0, 8)
      .map((plan) => ({
        _id: plan._id,
        examType: plan.examType,
        durationMonths: plan.durationMonths,
        dailyHours: plan.dailyHours,
        summaryAverageScore: plan.summaryAverageScore,
        weakSubjects: plan.weakSubjects || [],
        weakTopics: plan.weakTopics || [],
        source: plan.source,
        warning: plan.warning || "",
        createdAt: plan.createdAt,
        planText: plan.planText,
      }));

    const latestSelectedPlan = latestByStudent.get(selectedStudentId) || null;
    const weeklySummary = latestSelectedPlan
      ? {
          examType: latestSelectedPlan.examType,
          weeklyTargetHours: Number(latestSelectedPlan.dailyHours || 0) * 7,
          dailyHours: latestSelectedPlan.dailyHours,
          durationMonths: latestSelectedPlan.durationMonths,
          averageScore: latestSelectedPlan.summaryAverageScore,
          weakSubjects: latestSelectedPlan.weakSubjects || [],
          weakTopics: (latestSelectedPlan.weakTopics || []).slice(0, 5),
          generatedAt: latestSelectedPlan.createdAt,
        }
      : null;

    const children = linkedChildren
      .map((child) => {
        const key = String(child._id);
        const latestPlan = latestByStudent.get(key) || null;
        return {
          id: key,
          name: child.name || "Student",
          email: child.email || "",
          planCount: countByStudent.get(key) || 0,
          latestPlan: latestPlan
            ? {
                examType: latestPlan.examType,
                summaryAverageScore: latestPlan.summaryAverageScore,
                createdAt: latestPlan.createdAt,
              }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      success: true,
      children,
      selectedStudentId,
      selectedStudent: {
        id: selectedStudentId,
        name: selectedChild.name || "Student",
        email: selectedChild.email || "",
      },
      weeklySummary,
      history,
    });
  } catch (err) {
    console.error("Parent Exam Auto Plan Overview Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch parent exam prep summary",
    });
  }
};

/* ----------------------------------
   6) Role-Aware Study Buddy Chat
-----------------------------------*/
export const studyBuddyChat = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (!["student", "teacher", "parent"].includes(role)) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const message = toShortText(req.body?.message || "");
    if (!message) {
      return res.status(400).json({
        success: false,
        error: "message is required",
      });
    }

    const mode = normalizeChatMode(role, req.body?.mode);
    const { contextBundle, contextStudentId } = await resolveChatContextForRole({
      req,
      role,
      mode,
    });

    const session = await loadStudyBuddySession({
      userId: req.user._id,
      role,
      mode,
      contextStudentId,
    });
    const persistedHistory = toPromptHistoryFromSession(session?.messages || []);
    const history = persistedHistory.length
      ? persistedHistory
      : sanitizeChatHistory(req.body?.history);

    const prompt = buildRoleAwareChatPrompt({
      role,
      mode,
      message,
      history,
      promptContext: contextBundle.promptContext,
    });

    try {
      const aiReply = await askGemini(prompt);
      const savedSession = await saveStudyBuddyExchange({
        userId: req.user._id,
        role,
        mode,
        contextStudentId,
        userMessage: message,
        assistantMessage: aiReply,
        assistantSource: "ai",
      });
      return res.json({
        success: true,
        source: "ai",
        role,
        mode,
        reply: clipReply(aiReply),
        context: contextBundle.responseContext,
        conversationId: savedSession?._id || null,
        messages: toClientMessages(savedSession?.messages || []),
      });
    } catch (error) {
      const fallbackReply = buildRoleFallbackReply({
        role,
        mode,
        context: contextBundle.responseContext,
      });
      const savedSession = await saveStudyBuddyExchange({
        userId: req.user._id,
        role,
        mode,
        contextStudentId,
        userMessage: message,
        assistantMessage: fallbackReply,
        assistantSource: "fallback",
      });

      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            role,
            mode,
            reply: clipReply(fallbackReply),
            context: contextBundle.responseContext,
            conversationId: savedSession?._id || null,
            messages: toClientMessages(savedSession?.messages || []),
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("Study Buddy Chat Error:", err);
    const statusCode = Number(err?.statusCode);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      error: err?.message || "AI service unavailable",
    });
  }
};

export const getStudyBuddyHistory = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (!["student", "teacher", "parent"].includes(role)) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const mode = normalizeChatMode(role, req.query?.mode);
    const { contextBundle, contextStudentId } = await resolveChatContextForRole({
      req,
      role,
      mode,
    });
    const session = await loadStudyBuddySession({
      userId: req.user._id,
      role,
      mode,
      contextStudentId,
    });

    return res.json({
      success: true,
      role,
      mode,
      context: contextBundle.responseContext,
      conversationId: session?._id || null,
      messages: toClientMessages(session?.messages || []),
    });
  } catch (err) {
    console.error("Study Buddy History Error:", err);
    const statusCode = Number(err?.statusCode);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      error: err?.message || "Failed to load conversation history",
    });
  }
};

export const clearStudyBuddyHistory = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (!["student", "teacher", "parent"].includes(role)) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const mode = normalizeChatMode(role, req.query?.mode || req.body?.mode);
    const { contextStudentId } = await resolveChatContextForRole({
      req,
      role,
      mode,
    });

    await StudyBuddySession.deleteOne(
      buildSessionQuery({
        userId: req.user._id,
        role,
        mode,
        contextStudentId,
      })
    );

    return res.json({
      success: true,
      message: "Conversation cleared",
    });
  } catch (err) {
    console.error("Study Buddy Clear Error:", err);
    const statusCode = Number(err?.statusCode);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      error: err?.message || "Failed to clear conversation history",
    });
  }
};

/* ----------------------------------
   6) AI Weekly Study Plan + History
-----------------------------------*/
export const generateWeeklyPlan = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const { start, end } = getWeekRange();

    const submissions = await Submission.find({ student: studentId })
      .populate("test", "subject title")
      .populate("answers.question", "topic correctAnswer")
      .sort({ submittedAt: -1 })
      .limit(50);

    if (!submissions.length) {
      return res.status(400).json({
        success: false,
        error: "No submission history found. Attempt at least one test first.",
      });
    }

    const subjectBuckets = {};
    const topicMistakes = {};
    let scoreSum = 0;

    for (const sub of submissions) {
      const subject = String(sub.test?.subject || "general").toLowerCase();
      const pct = Number(sub.percentage || 0);
      scoreSum += pct;

      if (!subjectBuckets[subject]) {
        subjectBuckets[subject] = { attempts: 0, scoreSum: 0 };
      }
      subjectBuckets[subject].attempts += 1;
      subjectBuckets[subject].scoreSum += pct;

      for (const ans of sub.answers || []) {
        if (!ans?.question) continue;
        if (ans.selected !== ans.question.correctAnswer) {
          const topic = ans.question.topic || "General";
          topicMistakes[topic] = (topicMistakes[topic] || 0) + 1;
        }
      }
    }

    const attempts = submissions.length;
    const averageScore = Number((scoreSum / attempts).toFixed(2));

    const subjectPerformance = Object.entries(subjectBuckets).map(
      ([subject, v]) => ({
        subject,
        attempts: v.attempts,
        avgScore: Number((v.scoreSum / v.attempts).toFixed(2)),
      })
    );

    const weakSubjects = subjectPerformance
      .filter((s) => s.avgScore < 60)
      .sort((a, b) => a.avgScore - b.avgScore)
      .map((s) => s.subject);

    const weakTopics = Object.entries(topicMistakes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([topic]) => topic);

    const prompt = `
You are an academic coach.
Create a practical weekly study plan for a student.

Student analysis:
- Attempts: ${attempts}
- Average score: ${averageScore}%
- Weak subjects: ${JSON.stringify(weakSubjects)}
- Weak topics: ${JSON.stringify(weakTopics)}
- Subject performance: ${JSON.stringify(subjectPerformance)}

Return plain text with this exact structure:
1) Weekly Goal
2) Day-wise Plan (Mon-Sun)
3) Topic Focus
4) Practice Strategy
5) Revision + Mock Test Plan
6) Motivation Note

Keep it concise and student-friendly.
`;

    try {
      const planText = await askGemini(prompt);
      const saved = await StudyPlan.create({
        student: studentId,
        weekStart: start,
        weekEnd: end,
        summary: {
          attempts,
          averageScore,
          weakSubjects,
          weakTopics,
        },
        planText,
      });

      return res.json({
        success: true,
        source: "ai",
        plan: saved,
      });
    } catch (error) {
      const fallbackPlanText = buildWeeklyPlanFallback({
        attempts,
        averageScore,
        weakSubjects,
        weakTopics,
      });

      const savedFallback = await StudyPlan.create({
        student: studentId,
        weekStart: start,
        weekEnd: end,
        summary: {
          attempts,
          averageScore,
          weakSubjects,
          weakTopics,
        },
        planText: fallbackPlanText,
      });

      return res.json(
        withAiFallbackMeta(
          {
            success: true,
            plan: savedFallback,
          },
          error
        )
      );
    }
  } catch (err) {
    console.error("Weekly Plan Error:", err);
    return res.status(500).json({
      success: false,
      error: "AI service unavailable",
    });
  }
};

export const getWeeklyPlanHistory = async (req, res) => {
  try {
    const studentId = req.user._id || req.user.id;
    const history = await StudyPlan.find({ student: studentId })
      .sort({ createdAt: -1 })
      .limit(12);

    return res.json({
      success: true,
      history,
    });
  } catch (err) {
    console.error("Weekly Plan History Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch weekly plan history",
    });
  }
};

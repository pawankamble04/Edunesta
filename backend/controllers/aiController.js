import { AIServiceError, askGemini } from "../utils/gemini.js";
import Submission from "../models/Submission.js";
import ParentStudentLink from "../models/ParentStudentLink.js";
import StudyPlan from "../models/StudyPlan.js";

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
   2) AI Weak Topic Summary
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
   3) AI Next-Step Suggestions
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
   4) AI Weekly Study Plan + History
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

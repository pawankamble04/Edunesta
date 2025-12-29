import { askGemini } from "../utils/gemini.js";
import Submission from "../models/Submission.js";
import Question from "../models/Question.js";

/* ----------------------------------
   1️⃣ AI Question Quality Checker
-----------------------------------*/
export const reviewQuestion = async (req, res) => {
  try {
    const { question, options, correctAnswer, topic } = req.body;

    const prompt = `
You are an exam paper reviewer.

Analyze this MCQ carefully.

Question: ${question}
Options: ${options.join(", ")}
Correct Answer: ${
      Array.isArray(correctAnswer)
        ? correctAnswer.join(", ")
        : correctAnswer
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

    const aiText = await askGemini(prompt);

    const match = aiText.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: "Invalid AI response format",
      });
    }

    const parsed = JSON.parse(match[0]);

    res.json({
      success: true,
      review: parsed,
    });
  } catch (err) {
    console.error("AI Question Review Error:", err);
    res.status(500).json({
      success: false,
      error: "AI service unavailable",
    });
  }
};

/* ----------------------------------
   2️⃣ AI Weak Topic Summary
-----------------------------------*/
export const weakTopicSummary = async (req, res) => {
  try {
    const { studentId } = req.body;

    const submissions = await Submission.find({ student: studentId })
      .populate("answers.question");

    const weakTopics = {};

    submissions.forEach((sub) => {
      sub.answers.forEach((ans) => {
        if (
          ans.selected !== ans.question.correctAnswer
        ) {
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

    const summary = await askGemini(prompt);

    res.json({
      success: true,
      summary,
    });
  } catch (err) {
    console.error("Weak Topic Error:", err);
    res.status(500).json({
      success: false,
      error: "AI service unavailable",
    });
  }
};

/* ----------------------------------
   3️⃣ AI Next-Step Suggestions
-----------------------------------*/
export const nextStepSuggestions = async (req, res) => {
  try {
    const { stats } = req.body;

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

    const suggestions = await askGemini(prompt);

    res.json({
      success: true,
      suggestions,
    });
  } catch (err) {
    console.error("Next Steps Error:", err);
    res.status(500).json({
      success: false,
      error: "AI service unavailable",
    });
  }
};

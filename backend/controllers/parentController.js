import Submission from "../models/Submission.js";
import ParentStudentLink from "../models/ParentStudentLink.js";
import User from "../models/User.js";
import { askGemini } from "../utils/gemini.js";
import { getStudentDailySummary } from "../utils/dailySummary.js";

/* ================================
   Parent Dashboard
================================ */
const getParentDashboard = async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }

    const links = await ParentStudentLink.find({
      parentId: req.user._id,
      verified: true,
    });

    const studentIds = links.map((l) => l.studentId);

    if (studentIds.length === 0) {
      return res.json({ results: [] });
    }

    const submissions = await Submission.find({
      student: { $in: studentIds },
    })
      .populate("student", "name email")
      .populate("test", "title")
      .sort({ submittedAt: -1 });

    const results = submissions.map((s) => ({
      studentId: s.student?._id,
      studentName: s.student?.name || "Unknown",
      studentEmail: s.student?.email || "Unknown",
      testTitle: s.test?.title || "Unknown Test",
      score: s.score,
      totalMarks: s.totalMarks,
      date: s.submittedAt,
    }));

    res.json({ results });
  } catch (err) {
    console.error("Parent dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================================
   Parent → Children
================================ */
const getParentChildren = async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }

    const links = await ParentStudentLink.find({
      parentId: req.user._id,
      verified: true,
    }).populate("studentId", "name email");

    const children = links.map((l) => l.studentId).filter(Boolean);

    res.json({ children });
  } catch (err) {
    console.error("Get parent children error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================================
   Parent → Results per Child
================================ */
const getParentResultsByChild = async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { studentId } = req.params;

    const link = await ParentStudentLink.findOne({
      parentId: req.user._id,
      studentId,
      verified: true,
    });

    if (!link) {
      return res.status(403).json({ message: "Access denied" });
    }

    const student = await User.findById(studentId).select("name email");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const submissions = await Submission.find({
      student: studentId,
    })
      .select("test score totalMarks submittedAt")
      .populate("test", "title")
      .sort({ submittedAt: -1 });

    const results = submissions.map((s) => ({
      testId: s.test?._id,
      testTitle: s.test?.title || "Unknown Test",
      score: s.score,
      totalMarks: s.totalMarks,
      date: s.submittedAt,
    }));

    res.json({ student, results });
  } catch (err) {
    console.error("Parent results by child error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================================
   Parent → AI Summary
================================ */
const getParentAISummary = async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { studentId } = req.params;

    const link = await ParentStudentLink.findOne({
      parentId: req.user._id,
      studentId,
      verified: true,
    });

    if (!link) {
      return res.status(403).json({ message: "Access denied" });
    }

    const student = await User.findById(studentId).select("name email");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const submissions = await Submission.find({ student: studentId })
      .select("score totalMarks submittedAt")
      .sort({ submittedAt: -1 });

    if (submissions.length === 0) {
      return res.json({
        student,
        metrics: {
          attempts: 0,
          averageScore: 0,
          recentAverage: 0,
          trend: "no-data",
        },
        ai: {
          strengths: [],
          weaknesses: [],
          recommendations: ["Encourage the student to start attempting tests."],
        },
      });
    }

    const attempts = submissions.length;

    const percentages = submissions.map((s) => {
      if (!s.totalMarks || s.totalMarks === 0) return 0;
      return Math.round((s.score / s.totalMarks) * 100);
    });

    const averageScore = Math.round(
      percentages.reduce((a, b) => a + b, 0) / percentages.length
    );

    const recent = percentages.slice(0, Math.min(5, percentages.length));
    const recentAverage = Math.round(
      recent.reduce((a, b) => a + b, 0) / recent.length
    );

    let trend = "stable";
    if (recentAverage > averageScore + 3) trend = "improving";
    if (recentAverage < averageScore - 3) trend = "declining";

    const prompt = `
You are an education performance analyst for parents.

Student stats:
Attempts: ${attempts}
Average score: ${averageScore}%
Recent average: ${recentAverage}%
Trend: ${trend}

Give a short JSON response with:
{
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": string[]
}
`;

    let ai;
    try {
      const aiRaw = await askGemini(prompt);
      ai = JSON.parse(aiRaw);
    } catch {
      ai = {
        strengths: ["Basic understanding"],
        weaknesses: ["Consistency"],
        recommendations: ["Maintain a regular study routine"],
      };
    }

    res.json({
      student,
      metrics: { attempts, averageScore, recentAverage, trend },
      ai,
    });
  } catch (err) {
    console.error("Parent AI summary error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================================
   Parent → Link Student
================================ */
const linkStudentByCode = async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }

    const code = String(req.body?.code || "").trim();

    if (!code) {
      return res.status(400).json({ message: "Code is required" });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        message: "Code must be a valid 6-digit number",
      });
    }

    const student = await User.findOne({
      linkCode: code,
      linkCodeExpires: { $gt: new Date() },
      role: "student",
    });

    if (!student) {
      return res.status(400).json({
        message: "Invalid or expired link code",
      });
    }

    const existing = await ParentStudentLink.findOne({
      parentId: req.user._id,
      studentId: student._id,
    });

    if (existing) {
      return res.status(400).json({
        message: "Student already linked",
      });
    }

    await ParentStudentLink.create({
      parentId: req.user._id,
      studentId: student._id,
      verified: true,
    });

    student.linkCode = null;
    student.linkCodeExpires = null;
    await student.save();

    res.json({
      message: "Student linked successfully",
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
      },
    });
  } catch (err) {
    console.error("Link student error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================================
   Parent -> Daily Notifications
================================ */
const getParentDailyNotifications = async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }

    const links = await ParentStudentLink.find({
      parentId: req.user._id,
      verified: true,
    }).populate("studentId", "name email");

    const students = links.map((link) => link.studentId).filter(Boolean);
    if (!students.length) {
      return res.json({
        date: new Date().toISOString().slice(0, 10),
        notifications: [],
      });
    }

    const notifications = await Promise.all(
      students.map(async (student) => {
        const summary = await getStudentDailySummary(student._id);
        return {
          studentId: student._id,
          studentName: student.name,
          studentEmail: student.email,
          ...summary,
        };
      })
    );

    const date = notifications[0]?.date || new Date().toISOString().slice(0, 10);

    return res.json({
      date,
      notifications,
    });
  } catch (err) {
    console.error("Parent daily notifications error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export {
  getParentDashboard,
  getParentChildren,
  getParentResultsByChild,
  getParentAISummary,
  linkStudentByCode,
  getParentDailyNotifications,
};

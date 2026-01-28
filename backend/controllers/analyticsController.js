import Submission from "../models/Submission.js";
import Test from "../models/Test.js";

/**
 * ================================
 * STUDENT ANALYTICS
 * ================================
 * Student sees ONLY their own analytics
 */
export const getStudentAnalytics = async (req, res) => {
  try {
    const studentId = req.user.id;

    const submissions = await Submission.find({ student: studentId })
      .populate("test", "subject totalMarks")
      .sort({ createdAt: 1 });

    if (!submissions.length) {
      return res.json({
        progress: [],
        subjectPerformance: {},
        accuracy: 0,
        averageScore: 0,
      });
    }

    // 📈 Progress Graph Data
    const progress = submissions.map((s) => ({
      date: s.createdAt,
      score: s.score,
      total: s.test.totalMarks,
    }));

    // 🧠 Subject-wise Performance
    const subjectPerformance = {};
    let totalScore = 0;
    let totalMarks = 0;

    submissions.forEach((s) => {
      const subject = s.test.subject;

      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = {
          scored: 0,
          total: 0,
        };
      }

      subjectPerformance[subject].scored += s.score;
      subjectPerformance[subject].total += s.test.totalMarks;

      totalScore += s.score;
      totalMarks += s.test.totalMarks;
    });

    // 🎯 Accuracy Percentage
    const accuracy =
      totalMarks > 0 ? ((totalScore / totalMarks) * 100).toFixed(2) : 0;

    // 📊 Average Score
    const averageScore = (totalScore / submissions.length).toFixed(2);

    res.json({
      progress,
      subjectPerformance,
      accuracy,
      averageScore,
    });
  } catch (error) {
    console.error("Student analytics error:", error);
    res.status(500).json({ message: "Failed to load student analytics" });
  }
};

/**
 * ================================
 * PARENT ANALYTICS
 * ================================
 * Parent sees ONLY linked student's analytics
 */
export const getParentAnalytics = async (req, res) => {
  try {
    const studentId = req.user.student;

    if (!studentId) {
      return res
        .status(400)
        .json({ message: "No student linked to this parent" });
    }

    // Reuse student analytics logic
    req.user.id = studentId;
    return getStudentAnalytics(req, res);
  } catch (error) {
    console.error("Parent analytics error:", error);
    res.status(500).json({ message: "Failed to load parent analytics" });
  }
};

/**
 * ================================
 * TEACHER ANALYTICS
 * ================================
 * Teacher sees class/test level analytics
 */
export const getTeacherAnalytics = async (req, res) => {
  try {
    const { testId } = req.params;

    const submissions = await Submission.find({ test: testId });

    if (!submissions.length) {
      return res.json({
        classAverage: 0,
        highestScore: 0,
        lowestScore: 0,
      });
    }

    let totalScore = 0;
    let highestScore = 0;
    let lowestScore = submissions[0].score;

    submissions.forEach((s) => {
      totalScore += s.score;
      if (s.score > highestScore) highestScore = s.score;
      if (s.score < lowestScore) lowestScore = s.score;
    });

    const classAverage = (totalScore / submissions.length).toFixed(2);

    res.json({
      classAverage,
      highestScore,
      lowestScore,
    });
  } catch (error) {
    console.error("Teacher analytics error:", error);
    res.status(500).json({ message: "Failed to load teacher analytics" });
  }
};

import Submission from "../models/Submission.js";

const getParentDashboard = async (req, res) => {
  try {
    console.log("JWT USER:", req.user);

    // ✅ Allow only parent role
    if (req.user.role !== "parent") {
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ Fetch submissions
    const submissions = await Submission.find()
      .populate("student", "name email")
      .populate("test", "title");

    // ✅ Prepare results (FIXED)
    const results = submissions.map((s) => ({
      studentName: s.student?.name || "Unknown",
      studentEmail: s.student?.email || "Unknown",
      testTitle: s.test?.title || "Unknown Test",

      // 🔑 CORRECT VALUES
      score: s.score,                 // obtained marks
      totalMarks: s.totalMarks || 0,  // max marks

      date: s.submittedAt,
    }));

    res.json({ results });
  } catch (err) {
    console.error("Parent dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export { getParentDashboard };

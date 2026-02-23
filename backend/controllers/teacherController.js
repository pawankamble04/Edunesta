import User from "../models/User.js";
import Test from "../models/Test.js";
import Submission from "../models/Submission.js";
import Enrollment from "../models/Enrollment.js";
import { normalizeSubject } from "../utils/subject.js";

const dedupeSubjects = (subjects = []) => {
  const unique = new Set(subjects.map((s) => normalizeSubject(s)).filter(Boolean));
  return [...unique];
};

/* =========================================
   TEACHER DASHBOARD SNAPSHOT
========================================= */
export const getTeacherDashboard = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const teacherId = req.user._id;

    const [teacher, tests, enrollments] = await Promise.all([
      User.findById(teacherId).select("teacherJoinCode subjects"),
      Test.find({ createdBy: teacherId }).select("_id isPublished"),
      Enrollment.find({ teacher: teacherId }).populate("student", "name email"),
    ]);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const testIds = tests.map((t) => t._id);
    let totalScore = 0;
    let totalMarks = 0;
    let studentsAttempted = 0;

    if (testIds.length > 0) {
      const submissions = await Submission.find({
        test: { $in: testIds },
      }).select("student score totalMarks");

      const attemptedStudentIds = new Set();
      for (const s of submissions) {
        if (s.student) {
          attemptedStudentIds.add(String(s.student));
        }
        totalScore += Number(s.score) || 0;
        totalMarks += Number(s.totalMarks) || 0;
      }
      studentsAttempted = attemptedStudentIds.size;
    }

    const averageScore = totalMarks > 0
      ? Math.round((totalScore / totalMarks) * 100)
      : 0;

    const students = enrollments
      .filter((e) => e.student)
      .map((e) => ({
        id: e.student._id,
        name: e.student.name,
        email: e.student.email,
        subject: e.subject,
      }));

    return res.json({
      teacherJoinCode: teacher.teacherJoinCode || null,
      subjects: dedupeSubjects(teacher.subjects || []),
      students,
      stats: {
        testsCreated: tests.length,
        activeTests: tests.filter((t) => t.isPublished).length,
        studentsAttempted,
        averageScore: `${averageScore}%`,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load dashboard data" });
  }
};

/* =========================================
   GET MY SUBJECTS
========================================= */
export const getMySubjects = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const teacher = await User.findById(req.user._id).select("subjects");

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const normalizedSubjects = dedupeSubjects(teacher.subjects || []);
    return res.json({ subjects: normalizedSubjects });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch subjects" });
  }
};

/* =========================================
   ADD SUBJECT
========================================= */
export const addSubject = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    let { subject } = req.body;

    if (!subject || typeof subject !== "string") {
      return res.status(400).json({ message: "Invalid subject" });
    }

    subject = normalizeSubject(subject);

    if (subject.length < 2 || subject.length > 50) {
      return res.status(400).json({ message: "Invalid subject length" });
    }

    const teacher = await User.findById(req.user._id);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const normalizedSubjects = dedupeSubjects(teacher.subjects || []);
    if (normalizedSubjects.includes(subject)) {
      return res.status(400).json({ message: "Subject already exists" });
    }

    teacher.subjects = [...normalizedSubjects, subject];
    await teacher.save();

    return res.json({
      message: "Subject added successfully",
      subjects: teacher.subjects,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to add subject" });
  }
};

/* =========================================
   REMOVE SUBJECT
========================================= */
export const removeSubject = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    let { subject } = req.params;

    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    subject = normalizeSubject(subject);

    const teacher = await User.findById(req.user._id);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const normalizedSubjects = dedupeSubjects(teacher.subjects || []);
    teacher.subjects = normalizedSubjects.filter((s) => s !== subject);
    await teacher.save();

    return res.json({
      message: "Subject removed successfully",
      subjects: teacher.subjects,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to remove subject" });
  }
};

/* =========================================
   GET SUBJECTS BY JOIN CODE (Student)
========================================= */
export const getSubjectsByJoinCode = async (req, res) => {
  try {
    let { joinCode } = req.params;

    if (!joinCode) {
      return res.status(400).json({ message: "Join code is required" });
    }

    joinCode = joinCode.trim().toUpperCase();

    const teacher = await User.findOne({
      teacherJoinCode: joinCode,
      role: "teacher",
      isActive: true,
    }).select("name subjects");

    if (!teacher) {
      return res.status(404).json({
        message: "Invalid or inactive teacher",
      });
    }

    return res.json({
      teacherName: teacher.name,
      subjects: dedupeSubjects(teacher.subjects || []),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch subjects",
    });
  }
};

import User from "../models/User.js";
import Enrollment from "../models/Enrollment.js";
import { normalizeSubject } from "../utils/subject.js";

/* =========================================
   STUDENT CONNECT TO TEACHER
========================================= */
export const connectToTeacher = async (req, res) => {
  try {
    const studentId = req.user._id;
    let { joinCode, subject } = req.body;

    if (!joinCode || !subject) {
      return res.status(400).json({
        message: "Join code and subject are required",
      });
    }

    joinCode = joinCode.trim().toUpperCase();
    subject = normalizeSubject(subject);

    if (subject.length < 2 || subject.length > 50) {
      return res.status(400).json({
        message: "Invalid subject name",
      });
    }

    const teacher = await User.findOne({
      teacherJoinCode: joinCode,
      role: "teacher",
      isActive: true,
    });

    if (!teacher) {
      return res.status(404).json({
        message: "Invalid teacher join code",
      });
    }

    if (teacher._id.toString() === studentId.toString()) {
      return res.status(400).json({
        message: "You cannot connect to yourself",
      });
    }

    const subjectExists =
      teacher.subjects &&
      teacher.subjects.some((s) => normalizeSubject(s) === subject);

    if (!subjectExists) {
      return res.status(400).json({
        message: "Subject does not exist for this teacher",
      });
    }

    const alreadyConnected = await Enrollment.findOne({
      teacher: teacher._id,
      student: studentId,
      subject,
    });

    if (alreadyConnected) {
      return res.status(400).json({
        message: "Already connected to this teacher for this subject",
      });
    }

    await Enrollment.create({
      teacher: teacher._id,
      student: studentId,
      subject,
    });

    return res.json({
      message: "Connected successfully",
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
      },
      subject,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Connection failed",
    });
  }
};

/* =========================================
   TEACHER - LIST MY STUDENTS
========================================= */
export const listMyStudents = async (req, res) => {
  try {
    const teacherId = req.user._id;

    const enrollments = await Enrollment.find({
      teacher: teacherId,
    }).populate("student", "name email");

    return res.json(
      enrollments
        .filter((e) => e.student)
        .map((e) => ({
          id: e.student._id,
          name: e.student.name,
          email: e.student.email,
          subject: e.subject,
        }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch students",
    });
  }
};

/* =========================================
   STUDENT - LIST MY TEACHERS
========================================= */
export const listMyTeachers = async (req, res) => {
  try {
    const studentId = req.user._id;

    const enrollments = await Enrollment.find({
      student: studentId,
    }).populate("teacher", "name email");

    return res.json(
      enrollments
        .filter((e) => e.teacher)
        .map((e) => ({
          id: e.teacher._id,
          name: e.teacher.name,
          email: e.teacher.email,
          subject: e.subject,
        }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch teachers",
    });
  }
};

/* =========================================
   TEACHER - CONNECT SPECIFIC STUDENT
========================================= */
export const connectStudentByTeacher = async (req, res) => {
  try {
    const teacherId = req.user._id;
    let { studentEmail, subject } = req.body;

    if (!studentEmail || !subject) {
      return res.status(400).json({
        message: "Student email and subject are required",
      });
    }

    studentEmail = studentEmail.trim().toLowerCase();
    subject = normalizeSubject(subject);

    const teacher = await User.findOne({
      _id: teacherId,
      role: "teacher",
      isActive: true,
    }).select("subjects");

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    const subjectExists =
      teacher.subjects &&
      teacher.subjects.some((s) => normalizeSubject(s) === subject);

    if (!subjectExists) {
      return res.status(400).json({
        message: "Subject does not exist for this teacher",
      });
    }

    const student = await User.findOne({
      email: studentEmail,
      role: "student",
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        message: "Student not found or inactive",
      });
    }

    const alreadyConnected = await Enrollment.findOne({
      teacher: teacherId,
      student: student._id,
      subject,
    });

    if (alreadyConnected) {
      return res.status(400).json({
        message: "Student is already connected for this subject",
      });
    }

    await Enrollment.create({
      teacher: teacherId,
      student: student._id,
      subject,
    });

    return res.json({
      message: "Student connected successfully",
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
      },
      subject,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to connect student",
    });
  }
};

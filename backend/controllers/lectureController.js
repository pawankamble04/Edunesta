import Lecture from "../models/Lecture.js";
import LectureAttendance from "../models/LectureAttendance.js";
import Enrollment from "../models/Enrollment.js";
import { normalizeSubject } from "../utils/subject.js";
import { writeAuditLog } from "../utils/audit.js";
import { extractYouTubeVideoId } from "../utils/youtube.js";

const MAX_SUBJECT_LENGTH = 80;

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const sanitizeSubject = (value) => {
  const normalized = normalizeSubject(value);
  if (!normalized) return null;
  if (normalized.length < 2 || normalized.length > MAX_SUBJECT_LENGTH) {
    return null;
  }
  return normalized;
};

const toWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;
const toEmbedUrl = (videoId) => `https://www.youtube.com/embed/${videoId}`;

const serializeLecture = (lectureDoc) => {
  if (!lectureDoc) return null;

  const lecture = typeof lectureDoc.toObject === "function"
    ? lectureDoc.toObject()
    : lectureDoc;

  const creator = lecture.createdBy && typeof lecture.createdBy === "object"
    ? lecture.createdBy
    : null;

  return {
    _id: lecture._id,
    title: lecture.title,
    subject: lecture.subject,
    batch: lecture.batch || "",
    youtubeUrl: lecture.youtubeUrl,
    youtubeVideoId: lecture.youtubeVideoId,
    youtubeWatchUrl: toWatchUrl(lecture.youtubeVideoId),
    youtubeEmbedUrl: toEmbedUrl(lecture.youtubeVideoId),
    isPublished: Boolean(lecture.isPublished),
    createdBy: creator
      ? {
          _id: creator._id,
          name: creator.name,
          email: creator.email,
        }
      : lecture.createdBy,
    createdAt: lecture.createdAt,
    updatedAt: lecture.updatedAt,
  };
};

const parseBooleanQuery = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

const hasStudentLectureAccess = async ({ studentId, lecture }) => {
  if (!lecture || !studentId) return false;

  const subject = sanitizeSubject(lecture.subject);
  if (!subject) return false;

  return Boolean(
    await Enrollment.exists({
      student: studentId,
      teacher: lecture.createdBy,
      subject,
    })
  );
};

export const createLecture = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const subject = sanitizeSubject(req.body.subject);
    if (!subject) {
      return res.status(400).json({ message: "Invalid subject" });
    }

    const youtubeVideoId = extractYouTubeVideoId(req.body.youtubeUrl);
    if (!youtubeVideoId) {
      return res.status(400).json({ message: "Invalid YouTube link" });
    }

    const lecture = await Lecture.create({
      title: req.body.title.trim(),
      subject,
      batch: (req.body.batch || "").trim(),
      youtubeUrl: req.body.youtubeUrl.trim(),
      youtubeVideoId,
      isPublished: Boolean(req.body.isPublished),
      createdBy: req.user._id,
    });

    await writeAuditLog({
      action: "lecture.create",
      actor: req.user,
      target: "lecture",
      targetId: lecture._id,
      meta: {
        subject: lecture.subject,
        isPublished: lecture.isPublished,
      },
    });

    return res.status(201).json({
      message: "Lecture created successfully",
      lecture: serializeLecture(lecture),
    });
  } catch (error) {
    console.error("Create lecture error:", error);
    return res.status(500).json({ message: "Failed to create lecture" });
  }
};

export const listTeacherLectures = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const query = { createdBy: req.user._id };

    if (req.query.subject) {
      const subject = sanitizeSubject(req.query.subject);
      if (!subject) {
        return res.status(400).json({ message: "Invalid subject filter" });
      }
      query.subject = subject;
    }

    const isPublished = parseBooleanQuery(req.query.isPublished);
    if (isPublished !== null) {
      query.isPublished = isPublished;
    }

    const lectures = await Lecture.find(query).sort({ createdAt: -1 });
    return res.json(lectures.map(serializeLecture));
  } catch (error) {
    console.error("List teacher lectures error:", error);
    return res.status(500).json({ message: "Failed to fetch lectures" });
  }
};

export const updateLecture = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const lecture = await Lecture.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    if (typeof req.body.title === "string") {
      lecture.title = req.body.title.trim();
    }

    if (typeof req.body.batch === "string") {
      lecture.batch = req.body.batch.trim();
    }

    if (typeof req.body.subject === "string") {
      const subject = sanitizeSubject(req.body.subject);
      if (!subject) {
        return res.status(400).json({ message: "Invalid subject" });
      }
      lecture.subject = subject;
    }

    if (typeof req.body.youtubeUrl === "string") {
      const youtubeVideoId = extractYouTubeVideoId(req.body.youtubeUrl);
      if (!youtubeVideoId) {
        return res.status(400).json({ message: "Invalid YouTube link" });
      }
      lecture.youtubeUrl = req.body.youtubeUrl.trim();
      lecture.youtubeVideoId = youtubeVideoId;
    }

    await lecture.save();

    await writeAuditLog({
      action: "lecture.update",
      actor: req.user,
      target: "lecture",
      targetId: lecture._id,
      meta: {
        subject: lecture.subject,
      },
    });

    return res.json({
      message: "Lecture updated successfully",
      lecture: serializeLecture(lecture),
    });
  } catch (error) {
    console.error("Update lecture error:", error);
    return res.status(500).json({ message: "Failed to update lecture" });
  }
};

export const setLecturePublishState = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const lecture = await Lecture.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    lecture.isPublished = Boolean(req.body.isPublished);
    await lecture.save();

    await writeAuditLog({
      action: "lecture.publish",
      actor: req.user,
      target: "lecture",
      targetId: lecture._id,
      meta: {
        isPublished: lecture.isPublished,
      },
    });

    return res.json({
      message: lecture.isPublished
        ? "Lecture published successfully"
        : "Lecture unpublished successfully",
      lecture: serializeLecture(lecture),
    });
  } catch (error) {
    console.error("Set lecture publish state error:", error);
    return res.status(500).json({ message: "Failed to update lecture status" });
  }
};

export const deleteLecture = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const lecture = await Lecture.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    await LectureAttendance.deleteMany({ lecture: lecture._id });

    await writeAuditLog({
      action: "lecture.delete",
      actor: req.user,
      target: "lecture",
      targetId: lecture._id,
      meta: {
        subject: lecture.subject,
      },
    });

    return res.json({ message: "Lecture deleted successfully" });
  } catch (error) {
    console.error("Delete lecture error:", error);
    return res.status(500).json({ message: "Failed to delete lecture" });
  }
};

const buildEnrollmentKey = (teacherId, subject) =>
  `${String(teacherId)}::${sanitizeSubject(subject) || ""}`;

export const markLectureViewed = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }

    const lecture = await Lecture.findById(req.params.id).select(
      "_id createdBy subject isPublished"
    );

    if (!lecture || !lecture.isPublished) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const hasAccess = await hasStudentLectureAccess({
      studentId: req.user._id,
      lecture,
    });

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const viewedAt = new Date();
    await LectureAttendance.findOneAndUpdate(
      {
        lecture: lecture._id,
        student: req.user._id,
      },
      {
        $set: {
          teacher: lecture.createdBy,
          subject: sanitizeSubject(lecture.subject),
          status: "present",
          viewedAt,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({
      message: "Attendance marked",
      status: "Present",
      viewedAt: viewedAt.toISOString(),
    });
  } catch (error) {
    console.error("Mark lecture viewed error:", error);
    return res.status(500).json({ message: "Failed to mark attendance" });
  }
};

export const listStudentLectures = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }

    const enrollments = await Enrollment.find({
      student: req.user._id,
    }).select("teacher subject");

    if (!enrollments.length) {
      return res.json([]);
    }

    const teacherIds = [...new Set(enrollments.map((e) => String(e.teacher)))];
    const allowed = new Set(
      enrollments.map((e) => buildEnrollmentKey(e.teacher, e.subject))
    );

    const query = {
      createdBy: { $in: teacherIds },
      isPublished: true,
    };

    if (req.query.subject) {
      const subjectFilter = sanitizeSubject(req.query.subject);
      if (!subjectFilter) {
        return res.status(400).json({ message: "Invalid subject filter" });
      }
      query.subject = subjectFilter;
    }

    const lectures = await Lecture.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const filtered = lectures.filter((lecture) =>
      allowed.has(buildEnrollmentKey(lecture.createdBy?._id || lecture.createdBy, lecture.subject))
    );

    return res.json(filtered.map(serializeLecture));
  } catch (error) {
    console.error("List student lectures error:", error);
    return res.status(500).json({ message: "Failed to fetch lectures" });
  }
};

export const getLectureAttendance = async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }

    const lecture = await Lecture.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const enrollments = await Enrollment.find({
      teacher: req.user._id,
      subject: lecture.subject,
    }).populate("student", "name email");

    const studentRows = enrollments
      .filter((e) => e.student)
      .map((e) => ({
        studentId: String(e.student._id),
        name: e.student.name,
        email: e.student.email,
      }));

    if (!studentRows.length) {
      return res.json({
        lecture: serializeLecture(lecture),
        summary: {
          total: 0,
          present: 0,
          absent: 0,
        },
        attendance: [],
      });
    }

    const studentIds = studentRows.map((s) => s.studentId);
    const attendanceDocs = await LectureAttendance.find({
      lecture: lecture._id,
      student: { $in: studentIds },
    }).select("student viewedAt status");

    const attendanceByStudentId = new Map(
      attendanceDocs.map((doc) => [
        String(doc.student),
        {
          viewedAt: doc.viewedAt,
          status: doc.status,
        },
      ])
    );

    const attendance = studentRows.map((student) => {
      const record = attendanceByStudentId.get(student.studentId);
      const isPresent = Boolean(record && record.status === "present");

      return {
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        status: isPresent ? "Present" : "Absent",
        viewedAt: record?.viewedAt
          ? new Date(record.viewedAt).toISOString()
          : null,
      };
    });

    const present = attendance.filter((row) => row.status === "Present").length;
    const total = attendance.length;

    return res.json({
      lecture: serializeLecture(lecture),
      summary: {
        total,
        present,
        absent: total - present,
      },
      attendance,
    });
  } catch (error) {
    console.error("Get lecture attendance error:", error);
    return res.status(500).json({ message: "Failed to fetch attendance" });
  }
};

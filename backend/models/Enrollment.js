import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // Normalize for consistency
    },
  },
  { timestamps: true }
);

/* ==============================
   Prevent duplicate connections
   (teacher + student + subject)
============================== */
enrollmentSchema.index(
  { teacher: 1, student: 1, subject: 1 },
  { unique: true }
);

/* ==============================
   Optional: Extra safety check
============================== */
enrollmentSchema.pre("save", function (next) {
  if (this.teacher.toString() === this.student.toString()) {
    return next(new Error("Teacher and student cannot be the same"));
  }
  next();
});

export default mongoose.model("Enrollment", enrollmentSchema);
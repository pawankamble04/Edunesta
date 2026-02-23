import mongoose from "mongoose";

const parentStudentLinkSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    verified: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* 🔐 Prevent duplicate parent–student links */
parentStudentLinkSchema.index(
  { parentId: 1, studentId: 1 },
  { unique: true }
);

/* 🔒 Ensure parentId ≠ studentId */
parentStudentLinkSchema.pre("save", function (next) {
  if (this.parentId.toString() === this.studentId.toString()) {
    return next(new Error("Parent and student cannot be the same user"));
  }
  next();
});

export default mongoose.model(
  "ParentStudentLink",
  parentStudentLinkSchema
);

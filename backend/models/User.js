import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "teacher", "parent", "admin"],
      default: "student",
    },

    /* =========================
       Teacher Join Code
    ========================== */
    teacherJoinCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    /* =========================
       Teacher Subjects
    ========================== */
    subjects: {
      type: [String],
      default: [],
    },

    /* =========================
       Parent Linking
    ========================== */
    linkCode: {
      type: String,
      default: null,
      index: true,
    },

    linkCodeExpires: {
      type: Date,
      default: null,
    },

    /* =========================
       Admin Control
    ========================== */
    isActive: {
      type: Boolean,
      default: true,
    },

    /* =========================
       Auth Security
    ========================== */
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    loginLockUntil: {
      type: Date,
      default: null,
      index: true,
    },

    lastFailedLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);

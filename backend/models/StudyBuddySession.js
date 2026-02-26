import mongoose from "mongoose";

const studyBuddyMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2500,
    },
    source: {
      type: String,
      enum: ["user", "ai", "fallback", "system"],
      default: "user",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const studyBuddySessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["student", "teacher", "parent"],
      required: true,
      index: true,
    },
    mode: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    contextStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    messages: {
      type: [studyBuddyMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

studyBuddySessionSchema.index(
  { user: 1, role: 1, mode: 1, contextStudent: 1 },
  { unique: true }
);

export default mongoose.model("StudyBuddySession", studyBuddySessionSchema);

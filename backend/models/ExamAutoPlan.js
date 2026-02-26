import mongoose from "mongoose";

const examAutoPlanSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    examType: {
      type: String,
      enum: ["JEE", "NEET"],
      required: true,
    },
    durationMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 24,
    },
    dailyHours: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    goal: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    summaryAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    summaryAverageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    weakSubjects: {
      type: [String],
      default: [],
    },
    weakTopics: {
      type: [String],
      default: [],
    },
    planText: {
      type: String,
      required: true,
      maxlength: 40000,
    },
    source: {
      type: String,
      enum: ["ai", "fallback"],
      default: "ai",
    },
    aiStatus: {
      type: String,
      trim: true,
      default: "",
    },
    warning: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("ExamAutoPlan", examAutoPlanSchema);

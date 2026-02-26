import mongoose from "mongoose";

const codingRoadmapSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    language: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    durationMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    goal: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    planText: {
      type: String,
      required: true,
      maxlength: 30000,
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

export default mongoose.model("CodingRoadmap", codingRoadmapSchema);

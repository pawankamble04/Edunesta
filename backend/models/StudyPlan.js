import mongoose from "mongoose";

const studyPlanSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    weekStart: {
      type: Date,
      required: true,
    },
    weekEnd: {
      type: Date,
      required: true,
    },
    summary: {
      attempts: {
        type: Number,
        default: 0,
      },
      averageScore: {
        type: Number,
        default: 0,
      },
      weakSubjects: [String],
      weakTopics: [String],
    },
    planText: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("StudyPlan", studyPlanSchema);

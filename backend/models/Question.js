import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
      validate: [(v) => v.length >= 2, "At least 2 options required"],
    },
    correctAnswer: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0 && v < this.options.length;
        },
        message: "correctAnswer index is out of range",
      },
    },
    marks: {
      type: Number,
      default: 1,
      min: 1,
    },
    topic: String,
    aiReview: {
      clarityScore: {
        type: Number,
        min: 1,
        max: 10,
      },
      difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard"],
      },
      issues: [String],
      improvementSuggestions: [String],
      reviewedAt: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Question", questionSchema);

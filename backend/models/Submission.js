import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
      index: true,
    },

    answers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },
        selected: {
          type: Number,
          default: null,
        },
      },
    ],

    score: {
      type: Number,
      required: true,
      default: 0,
    },

    totalMarks: {
      type: Number,
      required: true,
      default: 0,
    },

    percentage: {
      type: Number,
      required: true,
      default: 0,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/* 🔐 HARD LOCK: ONE SUBMISSION PER STUDENT PER TEST */
submissionSchema.index(
  { student: 1, test: 1 },
  { unique: true }
);

export default mongoose.model("Submission", submissionSchema);

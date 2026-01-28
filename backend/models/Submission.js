import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
    },

    answers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
        },
        selected: Number,
        isCorrect: Boolean,
      },
    ],

    // ✅ obtained marks
    score: {
      type: Number,
      required: true,
    },

    // ✅ total marks for this test (teacher-defined)
    totalMarks: {
      type: Number,
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Submission", submissionSchema);

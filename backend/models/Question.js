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
    },
    correctAnswer: {
      type: Number,
      required: true,
    },
    marks: {
      type: Number,
      default: 1,
    },
    topic: String,
  },
  { timestamps: true }
);

export default mongoose.model("Question", questionSchema);

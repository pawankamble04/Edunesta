import mongoose from "mongoose";

const lectureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    batch: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    youtubeUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    youtubeVideoId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

lectureSchema.index({ createdBy: 1, subject: 1, createdAt: -1 });

export default mongoose.model("Lecture", lectureSchema);

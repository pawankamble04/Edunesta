import mongoose from "mongoose";

const parentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    role: {
      type: String,
      enum: ["parent"],
      default: "parent",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Parent", parentSchema);

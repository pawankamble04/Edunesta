import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    fileUrl: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return v.startsWith("/uploads/materials/");
        },
        message: "Invalid file path",
      },
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    visibleTo: {
      type: String,
      enum: ["all", "students", "teachers"],
      default: "students",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Material", materialSchema);

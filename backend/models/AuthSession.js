import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 128,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
      maxlength: 400,
    },
    ipAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
  },
  { timestamps: true }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("AuthSession", authSessionSchema);

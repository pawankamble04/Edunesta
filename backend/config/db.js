import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri =
      process.env.MONGO_URI || "mongodb://localhost:27017/edunesta";

    await mongoose.connect(uri, {
      dbName: "edunesta", // ✅ FORCE CORRECT DATABASE
    });

    console.log("MongoDB connected to edunesta");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

export default connectDB;

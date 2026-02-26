import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/edunesta";
    const dbName = String(process.env.MONGO_DB_NAME || "").trim();
    const options = dbName ? { dbName } : {};

    await mongoose.connect(uri, options);

    if (dbName) {
      console.log(`MongoDB connected to ${dbName}`);
    } else {
      console.log("MongoDB connected");
    }
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

export default connectDB;

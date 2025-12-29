import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

console.log("TEST ENV KEY:", process.env.GEMINI_API_KEY);

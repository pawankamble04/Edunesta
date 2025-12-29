import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { GoogleGenerativeAI } from "@google/generative-ai";

// ✅ HARD PROOF LOG
console.log(
  "🔑 GEMINI KEY INSIDE gemini.js:",
  process.env.GEMINI_API_KEY ? "YES" : "NO"
);

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY still missing after dotenv load");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ CONFIRMED WORKING MODEL (from your list-models)
const MODEL = "models/gemini-2.5-flash";

export const askGemini = async (prompt) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    return result.response.text();
  } catch (err) {
    console.error("🔥 GEMINI RUNTIME ERROR:", err);
    throw new Error("AI service unavailable");
  }
};

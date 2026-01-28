import mongoose from "mongoose";
import Question from "../models/Question.js";
import Test from "../models/Test.js";

export const addQuestion = async (req, res) => {
  try {
    const { testId } = req.params;
    const { text, options, correctAnswer, marks, topic } = req.body;

    if (!text || !options || options.length < 2) {
      return res.status(400).json({ message: "Invalid question data" });
    }

    if (
      correctAnswer === undefined ||
      correctAnswer < 0 ||
      correctAnswer >= options.length
    ) {
      return res.status(400).json({ message: "Invalid correct answer" });
    }

    if (!marks || Number(marks) <= 0) {
      return res
        .status(400)
        .json({ message: "Marks must be greater than 0" });
    }

    const question = await Question.create({
      test: testId,
      text,
      options,
      correctAnswer,
      marks: Number(marks),
      topic,
    });

    await Test.findByIdAndUpdate(testId, {
      $push: { questions: question._id },
    });

    res.json(question);
  } catch (err) {
    console.error("Add question error:", err);
    res.status(500).json({ message: "Failed to add question" });
  }
};

export const getQuestionsByTest = async (req, res) => {
  const questions = await Question.find({ test: req.params.testId });
  res.json(questions);
};

export const updateQuestion = async (req, res) => {
  const { id } = req.params;

  const updated = await Question.findByIdAndUpdate(
    id,
    req.body,
    { new: true }
  );

  if (!updated) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(updated);
};

export const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  const deleted = await Question.findByIdAndDelete(id);

  if (!deleted) {
    return res.status(404).json({ message: "Question not found" });
  }

  // 🔑 REMOVE question reference from Test
  await Test.findByIdAndUpdate(deleted.test, {
    $pull: { questions: deleted._id },
  });

  res.json({ message: "Question deleted successfully" });
};

import mongoose from "mongoose";
import Question from "../models/Question.js";

export const addQuestion = async (req, res) => {
  const { testId } = req.params;
  const question = await Question.create({
    test: testId,
    ...req.body,
  });
  res.json(question);
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

  res.json({ message: "Question deleted successfully" });
};

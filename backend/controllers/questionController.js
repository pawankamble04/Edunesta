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

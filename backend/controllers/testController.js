import Test from "../models/Test.js";

export const createTest = async (req, res) => {
  const test = await Test.create({
    ...req.body,
    createdBy: req.user.id,
  });
  res.json(test);
};

export const getTest = async (req, res) => {
  const test = await Test.findById(req.params.id).populate("questions");
  res.json(test);
};

export const publishTest = async (req, res) => {
  const test = await Test.findById(req.params.id);
  test.isPublished = true;
  await test.save();
  res.json(test);
};

export const listTests = async (req, res) => {
  const tests = await Test.find();
  res.json(tests);
};

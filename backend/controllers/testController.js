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
// ===============================
// PUBLISH / UNPUBLISH TEST
// ===============================
export const togglePublishTest = async (req, res) => {
  const { id } = req.params;

  const test = await Test.findById(id);
  if (!test) {
    return res.status(404).json({ message: "Test not found" });
  }

  test.isPublished = !test.isPublished;
  await test.save();

  res.json({
    message: test.isPublished
      ? "Test published successfully"
      : "Test unpublished successfully",
    isPublished: test.isPublished,
  });
};

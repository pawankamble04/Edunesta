import Test from "../models/Test.js";

export const createTest = async (req, res) => {
  try {
    const {
      title,
      description,
      durationMinutes,
      totalMarks,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (!totalMarks || Number(totalMarks) <= 0) {
      return res
        .status(400)
        .json({ message: "Total marks must be greater than 0" });
    }

    const test = await Test.create({
      title,
      description,
      durationMinutes,
      totalMarks: Number(totalMarks),
      createdBy: req.user.id,
    });

    res.json(test);
  } catch (err) {
    console.error("Create test error:", err);
    res.status(500).json({ message: "Failed to create test" });
  }
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
export const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findById(id);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // 🔐 Only creator teacher can delete
    if (String(test.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // 🧹 Cascade delete
    await Question.deleteMany({ test: id });
    await Submission.deleteMany({ test: id });
    await Test.findByIdAndDelete(id);

    res.json({ message: "Test deleted successfully" });
  } catch (err) {
    console.error("Delete test error:", err);
    res.status(500).json({ message: "Failed to delete test" });
  }
};

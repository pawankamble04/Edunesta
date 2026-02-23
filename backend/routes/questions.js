import express from "express";
import { protect } from "../middleware/auth.js";
import authorize from "../middleware/roles.js";
import { validate } from "../middleware/validate.js";
import {
  addQuestionSchema,
  objectIdParamSchema,
  updateQuestionSchema,
} from "../validation/schemas.js";

import {
  addQuestion,
  getQuestionsByTest,
  updateQuestion,
  deleteQuestion,
} from "../controllers/questionController.js";

const router = express.Router();

/* ===============================
   QUESTIONS BY TEST
=============================== */

// Teacher adds question to a test
router.post(
  "/test/:testId",
  protect,
  authorize("teacher"),
  validate(addQuestionSchema),
  addQuestion
);

// Teacher / Student fetch questions of a test
router.get(
  "/test/:testId",
  protect,
  authorize("teacher", "student", "admin"),
  validate(objectIdParamSchema("testId")),
  getQuestionsByTest
);

/* ===============================
   SINGLE QUESTION OPS
=============================== */

// Teacher updates a question
router.put(
  "/:id",
  protect,
  authorize("teacher"),
  validate(updateQuestionSchema),
  updateQuestion
);

// Teacher deletes a question
router.delete(
  "/:id",
  protect,
  authorize("teacher"),
  validate(objectIdParamSchema("id")),
  deleteQuestion
);

export default router;

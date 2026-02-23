import { ZodError } from "zod";

const formatZodIssues = (issues = []) =>
  issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      if (parsed.body) req.body = parsed.body;
      if (parsed.params) req.params = parsed.params;
      if (parsed.query) req.query = parsed.query;

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: formatZodIssues(error.issues),
        });
      }

      return next(error);
    }
  };
};

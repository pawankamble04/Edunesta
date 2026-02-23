const statusCodeToErrorCode = (statusCode) => {
  if (statusCode === 400) return "BAD_REQUEST";
  if (statusCode === 401) return "UNAUTHORIZED";
  if (statusCode === 403) return "FORBIDDEN";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 409) return "CONFLICT";
  if (statusCode === 413) return "PAYLOAD_TOO_LARGE";
  if (statusCode === 429) return "RATE_LIMITED";
  if (statusCode >= 500) return "INTERNAL_ERROR";
  return "REQUEST_FAILED";
};

export const errorContract = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (res.statusCode >= 400) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        payload?.msg ||
        "Request failed";

      const code =
        payload?.error?.code ||
        payload?.code ||
        statusCodeToErrorCode(res.statusCode);

      const details =
        payload?.error?.details ||
        payload?.details ||
        payload?.errors;

      const normalized = {
        success: false,
        message,
        error: {
          code,
          message,
        },
      };

      if (details !== undefined) {
        normalized.error.details = details;
      }

      return originalJson(normalized);
    }

    return originalJson(payload);
  };

  return next();
};

export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    code: "NOT_FOUND",
    message: "Route not found",
  });
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = Number(err?.statusCode || err?.status || 500);
  const safeStatusCode =
    Number.isFinite(statusCode) && statusCode >= 400 && statusCode <= 599
      ? statusCode
      : 500;

  if (safeStatusCode >= 500) {
    console.error(err);
  }

  return res.status(safeStatusCode).json({
    code: err?.code || statusCodeToErrorCode(safeStatusCode),
    message: err?.message || "Internal server error",
    details: err?.details,
  });
};

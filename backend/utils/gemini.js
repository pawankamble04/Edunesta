import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "models/gemini-2.5-flash";

let genAI = null;
let providerCooldownUntil = 0;
let providerCooldownError = null;

export class AIServiceError extends Error {
  constructor(
    message,
    {
      statusCode = 503,
      code = "AI_UNAVAILABLE",
      retryAfterSeconds = null,
      cause = null,
    } = {}
  ) {
    super(message);
    this.name = "AIServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.cause = cause;
  }
}

const extractStatusCode = (message) => {
  const match = String(message || "").match(/\[(\d{3})\s+[^\]]+\]/);
  const status = Number(match?.[1]);
  return Number.isFinite(status) ? status : null;
};

const extractRetryAfterSeconds = (message) => {
  const normalized = String(message || "");
  const fromFriendly = normalized.match(/retry in\s+([\d.]+)s/i);
  if (fromFriendly) {
    const seconds = Math.ceil(Number(fromFriendly[1]));
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }

  const fromRpc = normalized.match(/retryDelay":"(\d+)s"/i);
  if (fromRpc) {
    const seconds = Number(fromRpc[1]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }

  return null;
};

export const normalizeGeminiError = (err) => {
  if (err instanceof AIServiceError) return err;

  const rawMessage = String(err?.message || err || "AI service unavailable");
  const rawStatus = Number(err?.status || err?.response?.status);
  const statusCode = Number.isFinite(rawStatus)
    ? rawStatus
    : extractStatusCode(rawMessage);
  const retryAfterSeconds = extractRetryAfterSeconds(rawMessage);

  if (statusCode === 429) {
    return new AIServiceError("AI quota reached. Please try again later.", {
      statusCode: 429,
      code: "AI_QUOTA_EXCEEDED",
      retryAfterSeconds: retryAfterSeconds || 10,
      cause: err,
    });
  }

  if (statusCode === 401 || statusCode === 403) {
    return new AIServiceError(
      "AI provider authentication failed. Check API key and permissions.",
      {
        statusCode: 502,
        code: "AI_PROVIDER_AUTH_FAILED",
        cause: err,
      }
    );
  }

  if (statusCode >= 500) {
    return new AIServiceError("AI provider is temporarily unavailable.", {
      statusCode: 503,
      code: "AI_PROVIDER_UNAVAILABLE",
      retryAfterSeconds: retryAfterSeconds || 5,
      cause: err,
    });
  }

  if (/timeout|timed out|network|econn|fetch failed/i.test(rawMessage)) {
    return new AIServiceError("AI provider is temporarily unavailable.", {
      statusCode: 503,
      code: "AI_PROVIDER_UNAVAILABLE",
      retryAfterSeconds: retryAfterSeconds || 5,
      cause: err,
    });
  }

  return new AIServiceError("AI service unavailable", {
    statusCode: 503,
    code: "AI_UNAVAILABLE",
    retryAfterSeconds,
    cause: err,
  });
};

const getCooldownError = () => {
  if (!providerCooldownUntil || Date.now() >= providerCooldownUntil) {
    providerCooldownUntil = 0;
    providerCooldownError = null;
    return null;
  }

  const remaining = Math.ceil((providerCooldownUntil - Date.now()) / 1000);
  const base = providerCooldownError || {};
  return new AIServiceError(
    base.message || "AI provider is temporarily unavailable.",
    {
      statusCode: base.statusCode || 503,
      code: base.code || "AI_PROVIDER_UNAVAILABLE",
      retryAfterSeconds: Math.max(remaining, 1),
      cause: base.cause || null,
    }
  );
};

const applyCooldown = (normalizedError) => {
  if (
    normalizedError?.code !== "AI_QUOTA_EXCEEDED" &&
    normalizedError?.code !== "AI_PROVIDER_UNAVAILABLE"
  ) {
    return;
  }

  const seconds = Math.max(Number(normalizedError.retryAfterSeconds || 5), 5);
  providerCooldownUntil = Date.now() + seconds * 1000;
  providerCooldownError = normalizedError;
};

const getClient = () => {
  if (genAI) return genAI;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
};

export const askGemini = async (prompt) => {
  const cooldownError = getCooldownError();
  if (cooldownError) {
    throw cooldownError;
  }

  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: MODEL });

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
    const normalizedError = normalizeGeminiError(err);
    applyCooldown(normalizedError);
    console.error(
      "Gemini runtime error:",
      normalizedError.code,
      normalizedError.message
    );
    throw normalizedError;
  }
};

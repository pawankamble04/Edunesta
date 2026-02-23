import test from "node:test";
import assert from "node:assert/strict";
import { AIServiceError, normalizeGeminiError } from "../utils/gemini.js";

test("gemini error normalization: maps quota failures to AI_QUOTA_EXCEEDED", () => {
  const err = new Error(
    "[GoogleGenerativeAI Error]: [429 Too Many Requests] Quota exceeded. Please retry in 7.2s."
  );

  const normalized = normalizeGeminiError(err);

  assert.equal(normalized instanceof AIServiceError, true);
  assert.equal(normalized.statusCode, 429);
  assert.equal(normalized.code, "AI_QUOTA_EXCEEDED");
  assert.equal(normalized.retryAfterSeconds, 8);
});

test("gemini error normalization: maps auth failures to AI_PROVIDER_AUTH_FAILED", () => {
  const err = new Error("[GoogleGenerativeAI Error]: [403 Forbidden]");
  const normalized = normalizeGeminiError(err);

  assert.equal(normalized.statusCode, 502);
  assert.equal(normalized.code, "AI_PROVIDER_AUTH_FAILED");
});

test("gemini error normalization: maps provider 5xx to AI_PROVIDER_UNAVAILABLE", () => {
  const err = new Error("[GoogleGenerativeAI Error]: [503 Service Unavailable]");
  const normalized = normalizeGeminiError(err);

  assert.equal(normalized.statusCode, 503);
  assert.equal(normalized.code, "AI_PROVIDER_UNAVAILABLE");
  assert.equal(normalized.retryAfterSeconds, 5);
});

test("gemini error normalization: preserves AIServiceError instances", () => {
  const original = new AIServiceError("already normalized", {
    statusCode: 429,
    code: "AI_QUOTA_EXCEEDED",
    retryAfterSeconds: 12,
  });

  const normalized = normalizeGeminiError(original);
  assert.equal(normalized, original);
});

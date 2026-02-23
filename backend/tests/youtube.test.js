import test from "node:test";
import assert from "node:assert/strict";
import { extractYouTubeVideoId, isValidYouTubeUrl } from "../utils/youtube.js";

test("extractYouTubeVideoId supports watch links", () => {
  const id = extractYouTubeVideoId(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  );
  assert.equal(id, "dQw4w9WgXcQ");
});

test("extractYouTubeVideoId supports short links", () => {
  const id = extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=12");
  assert.equal(id, "dQw4w9WgXcQ");
});

test("extractYouTubeVideoId supports embed links", () => {
  const id = extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(id, "dQw4w9WgXcQ");
});

test("extractYouTubeVideoId rejects invalid links", () => {
  assert.equal(extractYouTubeVideoId("https://example.com/video"), null);
  assert.equal(isValidYouTubeUrl("not-a-url"), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSubject } from "../utils/subject.js";

test("normalizeSubject maps math aliases to math", () => {
  assert.equal(normalizeSubject("math"), "math");
  assert.equal(normalizeSubject("maths"), "math");
  assert.equal(normalizeSubject("mathematics"), "math");
});

test("normalizeSubject trims and lowercases", () => {
  assert.equal(normalizeSubject("  PHYSICS "), "physics");
});

test("normalizeSubject handles empty values safely", () => {
  assert.equal(normalizeSubject(""), "");
  assert.equal(normalizeSubject(null), "");
  assert.equal(normalizeSubject(undefined), "");
});

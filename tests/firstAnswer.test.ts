import { test } from "node:test";
import assert from "node:assert/strict";
import { firstAnswer } from "../src/lib/letters.ts";

test("a hedged list keeps only its first answer", () => {
  assert.deepEqual(firstAnswer("Philippines, Palestine, Portugal"), { value: "Philippines", trimmed: true });
  assert.deepEqual(firstAnswer("فلسطين، فرنسا"), { value: "فلسطين", trimmed: true });
  assert.deepEqual(firstAnswer("Paris / Peru"), { value: "Paris", trimmed: true });
  assert.deepEqual(firstAnswer("Paris; Peru"), { value: "Paris", trimmed: true });
  assert.deepEqual(firstAnswer("Paris | Peru"), { value: "Paris", trimmed: true });
  assert.deepEqual(firstAnswer("Paris & Peru"), { value: "Paris", trimmed: true });
  assert.deepEqual(firstAnswer("Paris + Peru"), { value: "Paris", trimmed: true });
  assert.deepEqual(firstAnswer("Paris or Peru"), { value: "Paris", trimmed: true });
  assert.deepEqual(firstAnswer("بيروت أو باريس"), { value: "بيروت", trimmed: true });
  assert.deepEqual(firstAnswer("Paris\nPeru"), { value: "Paris", trimmed: true });
});

test("single answers with spaces or hyphens are left alone", () => {
  for (const one of ["New York", "Guinea-Bissau", "Trinidad and Tobago", "Bill Gates", "سيارة إسعاف", "عبد الله", "Oregon", "Portland"]) {
    assert.deepEqual(firstAnswer(one), { value: one, trimmed: false }, one);
  }
});

test("stray separators and blanks do not count as extra answers", () => {
  assert.deepEqual(firstAnswer("Paris,"), { value: "Paris", trimmed: false });
  assert.deepEqual(firstAnswer(", Paris"), { value: "Paris", trimmed: false });
  assert.deepEqual(firstAnswer("  "), { value: "", trimmed: false });
  assert.deepEqual(firstAnswer(""), { value: "", trimmed: false });
});

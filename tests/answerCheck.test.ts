import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalChecker, editDistance } from "../src/lib/answerCheck.ts";
import { normalizeAnswer } from "../src/lib/letters.ts";

const lists = {
  country: { en: ["palestine", "peru", "paris", "asia", "jordan"], ar: ["فلسطين", "باريس", "آسيا", "الرياض", "جدة"] },
  animal: { en: ["horse", "lion", "panda"], ar: ["أسد", "حصان", "نمر"] },
  object: { en: ["house", "table"], ar: ["طاولة"] },
};
const check = createLocalChecker(lists, normalizeAnswer);

test("exact hits verify, in either language, with or without the article", () => {
  assert.deepEqual(check("country", "Palestine"), { kind: "exact", canonical: "palestine" });
  assert.deepEqual(check("country", "  PERU "), { kind: "exact", canonical: "peru" });
  assert.deepEqual(check("country", "فلسطين"), { kind: "exact", canonical: "فلسطين" });
  assert.deepEqual(check("country", "اسيا"), { kind: "exact", canonical: "آسيا" }, "hamza folded");
  assert.deepEqual(check("country", "رياض"), { kind: "exact", canonical: "الرياض" }, "article optional");
  assert.deepEqual(check("country", "جده"), { kind: "exact", canonical: "جدة" }, "taa marbuta folded");
  assert.deepEqual(check("animal", "الأسد"), { kind: "exact", canonical: "أسد" });
});

test("wrong category is not verified", () => {
  assert.equal(check("animal", "table"), null);
  assert.equal(check("country", "lion"), null);
  assert.equal(check("animal", "طاولة"), null);
  assert.equal(check("movie", "Titanic"), null, "no list for this category");
});

test("a typo only suggests the spelling", () => {
  assert.deepEqual(check("country", "palastine"), { kind: "suggest", canonical: "palestine" });
  assert.deepEqual(check("country", "palestien"), { kind: "suggest", canonical: "palestine" });
});

test("no suggestion when the near miss is a real word elsewhere, or too short to tell", () => {
  assert.equal(check("animal", "house"), null, "house is an object, not a misspelt horse");
  assert.equal(check("animal", "lyon"), null, "4 letters: too short to correct");
});

test("six letters is long enough for one-letter typos", () => {
  assert.deepEqual(check("country", "jordon"), { kind: "suggest", canonical: "jordan" });
});

test("edit distance gives up early past the limit", () => {
  assert.equal(editDistance("palastine", "palestine", 2), 1);
  assert.equal(editDistance("abc", "xyz", 1), 2);
  assert.equal(editDistance("a", "abcd", 1), 2);
});

test("swapped neighbouring letters are one edit", () => {
  assert.equal(editDistance("denamrk", "denmark", 1), 1);
  assert.equal(editDistance("ab", "ba", 1), 1);
  assert.equal(editDistance("abcdef", "badcfe", 2), 3);
});

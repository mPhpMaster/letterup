import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABETS, HARD_LETTERS, normalizeAnswer, pickLetter, startsWithLetter } from "../src/lib/letters.ts";

test("normalizes Latin case, accents and punctuation", () => {
  assert.equal(normalizeAnswer("  Élan-Vital!! "), "elan vital");
});

test("normalizes Arabic alef variants, harakat, taa marbuta and tatweel", () => {
  assert.equal(normalizeAnswer("أَسَد"), "اسد");
  assert.equal(normalizeAnswer("إسطنبول"), "اسطنبول");
  assert.equal(normalizeAnswer("آلة"), "اله");
  assert.equal(normalizeAnswer("مـــوز"), "موز");
  assert.equal(normalizeAnswer("مستشفى"), "مستشفي");
});

test("letter check handles Arabic hamza forms and the definite article", () => {
  assert.equal(startsWithLetter(normalizeAnswer("إبراهيم"), "أ"), true);
  assert.equal(startsWithLetter(normalizeAnswer("البطة"), "ب"), true);
  assert.equal(startsWithLetter(normalizeAnswer("بطة"), "ت"), false);
  assert.equal(startsWithLetter(normalizeAnswer("Banana"), "B"), true);
  assert.equal(startsWithLetter(normalizeAnswer("The Rock"), "R"), true);
  assert.equal(startsWithLetter("", "B"), false);
});

test("pickLetter avoids used and hard letters, then recycles", () => {
  const used = ALPHABETS.en.filter((l) => l !== "M");
  assert.equal(pickLetter("en", used, true), "M");
  for (let i = 0; i < 200; i++) {
    assert.ok(!HARD_LETTERS.ar.includes(pickLetter("ar", [], true)));
  }
  const all = [...ALPHABETS.en];
  assert.ok(ALPHABETS.en.includes(pickLetter("en", all, false)));
});

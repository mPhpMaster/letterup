import { test } from "node:test";
import assert from "node:assert/strict";
import { isRealAnswer } from "../src/lib/letters.ts";

test("a bare letter is not an answer", () => {
  for (const blank of ["P", "p", " P ", "ب", "أ", "", "   ", "P.", "-"]) {
    assert.equal(isRealAnswer(blank), false, JSON.stringify(blank));
  }
});

test("short but real answers still count", () => {
  for (const real of ["Ox", "Peru", "UK", "بط", "فهد", "New York"]) {
    assert.equal(isRealAnswer(real), true, real);
  }
});

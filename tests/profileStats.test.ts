import { test } from "node:test";
import assert from "node:assert/strict";
import { levelFromPoints, percent, tierFromRank, topLetters, trendPercent, winStreaks } from "../src/lib/profileStats.ts";

test("level starts at 1 and climbs every 500 points", () => {
  assert.deepEqual(levelFromPoints(0), { level: 1, xp: 0, needed: 500 });
  assert.deepEqual(levelFromPoints(499), { level: 1, xp: 499, needed: 500 });
  assert.deepEqual(levelFromPoints(500), { level: 2, xp: 0, needed: 500 });
  assert.deepEqual(levelFromPoints(1265), { level: 3, xp: 265, needed: 500 });
});

test("tier badges follow the global rank", () => {
  assert.equal(tierFromRank(1), "legendary");
  assert.equal(tierFromRank(3), "legendary");
  assert.equal(tierFromRank(4), "elite");
  assert.equal(tierFromRank(50), "pro");
  assert.equal(tierFromRank(51), null);
  assert.equal(tierFromRank(null), null);
});

test("streaks count shared wins and reset on a loss", () => {
  const W = { won: true, tied: false };
  const T = { won: false, tied: true };
  const L = { won: false, tied: false };
  assert.deepEqual(winStreaks([]), { current: 0, longest: 0 });
  assert.deepEqual(winStreaks([W, W, L, W, T, W]), { current: 3, longest: 3 });
  assert.deepEqual(winStreaks([W, W, W, L]), { current: 0, longest: 3 });
});

test("trend compares the later half with the earlier half", () => {
  assert.equal(trendPercent([10, 20, 30]), null); // too few games
  assert.equal(trendPercent([0, 0, 10, 10]), null); // no baseline
  assert.equal(trendPercent([20, 20, 30, 30]), 50);
  assert.equal(trendPercent([40, 40, 40, 20, 20]), -50); // odd count skips the middle game
});

test("percent guards against dividing by zero", () => {
  assert.equal(percent(1, 0), null);
  assert.equal(percent(2, 3), 67);
});

test("letter fingerprint picks the most used letters, ties alphabetically", () => {
  assert.deepEqual(topLetters(["S", "M", "S", "A", "M", "S", "V", "B"]), ["S", "M", "A", "B"]);
});

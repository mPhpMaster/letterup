import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryVoteMs, REVIEWED_GRACE_MS } from "../src/lib/voteTiming.ts";

test("the category clock follows the answers on screen, not the player count", () => {
  assert.equal(categoryVoteMs(0), 6_000, "nothing to vote on: the shortest window (it is skipped anyway)");
  assert.equal(categoryVoteMs(1), 6_500);
  assert.equal(categoryVoteMs(2), 9_000);
  assert.equal(categoryVoteMs(3), 11_500);
  assert.equal(categoryVoteMs(8), 15_000, "a full room is capped, not 40 seconds");
  assert.equal(categoryVoteMs(40), 15_000);
});

test("the look-over grace after the last category is short and fixed", () => {
  assert.equal(REVIEWED_GRACE_MS, 5_000);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { authorSelfApproval, computeRoundScores, isAnswerValid, type ScorableAnswer } from "../src/lib/scoring.ts";

const ans = (id: string, playerId: string, category: string, normalized: string, extra: Partial<ScorableAnswer> = {}): ScorableAnswer => ({
  id, playerId, category, normalized, autoValid: normalized !== "", hostVerdict: null, ...extra,
});

test("unique valid answers score 10, duplicates 5, blanks 0", () => {
  const scores = computeRoundScores(
    [ans("a", "p1", "animal", "bear"), ans("b", "p2", "animal", "bear"), ans("c", "p3", "animal", "bison"), ans("d", "p4", "animal", "")],
    [],
    4,
  );
  assert.deepEqual(scores.map((s) => s.points), [5, 5, 10, 0]);
});

test("invalid answers do not make others duplicates", () => {
  const scores = computeRoundScores(
    [ans("a", "p1", "animal", "bear"), ans("b", "p2", "animal", "bear", { hostVerdict: false })],
    [],
    3,
  );
  assert.deepEqual(scores.map((s) => s.points), [10, 0]);
});

test("same word in different categories is not a duplicate", () => {
  const scores = computeRoundScores([ans("a", "p1", "animal", "bat"), ans("b", "p2", "object", "bat")], [], 3);
  assert.deepEqual(scores.map((s) => s.points), [10, 10]);
});

test("with 3+ players the author counts as one approval, so a lone 👎 can't veto", () => {
  const a = ans("a", "p1", "plant", "basil");
  assert.equal(authorSelfApproval(3), 1);
  assert.equal(isAnswerValid(a, [{ answerId: "a", approve: false }], 3), true);
  assert.equal(isAnswerValid(a, [{ answerId: "a", approve: false }, { answerId: "a", approve: false }], 3), false);
  assert.equal(
    isAnswerValid(a, [{ answerId: "a", approve: false }, { answerId: "a", approve: false }, { answerId: "a", approve: true }], 3),
    true,
  );
});

test("in a 2-player game the single opponent's 👎 decides", () => {
  const a = ans("a", "p1", "plant", "basil");
  assert.equal(authorSelfApproval(2), 0);
  assert.equal(isAnswerValid(a, [], 2), true, "no vote cast leaves it valid");
  assert.equal(isAnswerValid(a, [{ answerId: "a", approve: false }], 2), false, "opponent rejects");
  assert.equal(isAnswerValid(a, [{ answerId: "a", approve: true }], 2), true, "opponent accepts");
});

test("host verdict overrides votes and letter check, but never blanks", () => {
  assert.equal(isAnswerValid(ans("a", "p1", "human", "xavier", { autoValid: false, hostVerdict: true }), [], 3), true);
  assert.equal(isAnswerValid(ans("a", "p1", "human", "bob", { hostVerdict: false }), [], 3), false);
  assert.equal(isAnswerValid(ans("a", "p1", "human", "", { hostVerdict: true }), [], 3), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRoundScores, isAnswerValid, type ScorableAnswer } from "../src/lib/scoring.ts";

const ans = (id: string, playerId: string, category: string, normalized: string, extra: Partial<ScorableAnswer> = {}): ScorableAnswer => ({
  id, playerId, category, normalized, autoValid: normalized !== "", hostVerdict: null, ...extra,
});

test("unique valid answers score 10, duplicates 5, blanks 0", () => {
  const scores = computeRoundScores(
    [ans("a", "p1", "animal", "bear"), ans("b", "p2", "animal", "bear"), ans("c", "p3", "animal", "bison"), ans("d", "p4", "animal", "")],
    [],
  );
  assert.deepEqual(scores.map((s) => s.points), [5, 5, 10, 0]);
});

test("invalid answers do not make others duplicates", () => {
  const scores = computeRoundScores(
    [ans("a", "p1", "animal", "bear"), ans("b", "p2", "animal", "bear", { hostVerdict: false })],
    [],
  );
  assert.deepEqual(scores.map((s) => s.points), [10, 0]);
});

test("same word in different categories is not a duplicate", () => {
  const scores = computeRoundScores([ans("a", "p1", "animal", "bat"), ans("b", "p2", "object", "bat")], []);
  assert.deepEqual(scores.map((s) => s.points), [10, 10]);
});

test("author counts as implicit approval; rejections must outnumber approvals", () => {
  const a = ans("a", "p1", "plant", "basil");
  assert.equal(isAnswerValid(a, [{ answerId: "a", approve: false }]), true); // 1 vs 1 -> valid
  assert.equal(isAnswerValid(a, [{ answerId: "a", approve: false }, { answerId: "a", approve: false }]), false);
  assert.equal(
    isAnswerValid(a, [{ answerId: "a", approve: false }, { answerId: "a", approve: false }, { answerId: "a", approve: true }]),
    true,
  );
});

test("host verdict overrides votes and letter check, but never blanks", () => {
  assert.equal(isAnswerValid(ans("a", "p1", "human", "xavier", { autoValid: false, hostVerdict: true }), []), true);
  assert.equal(isAnswerValid(ans("a", "p1", "human", "bob", { hostVerdict: false }), []), false);
  assert.equal(isAnswerValid(ans("a", "p1", "human", "", { hostVerdict: true }), []), false);
});

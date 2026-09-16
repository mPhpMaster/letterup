import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_IDS, categoryEmoji, normalizeCategories } from "../src/lib/categories.ts";

test("City is no longer its own category", () => {
  assert.ok(!CATEGORY_IDS.includes("city"));
  assert.ok(CATEGORY_IDS.includes("country"));
});

test("a saved City maps onto Country / City", () => {
  assert.deepEqual(normalizeCategories(["human", "city"]), ["human", "country"]);
});

test("picking both old ids leaves a single merged category", () => {
  assert.deepEqual(normalizeCategories(["country", "animal", "city"]), ["animal", "country"]);
});

test("unknown ids are dropped and the canonical order is kept", () => {
  assert.deepEqual(normalizeCategories(["object", "nonsense", "human"]), ["human", "object"]);
});

test("old rounds that stored city still get the merged category's emoji", () => {
  assert.equal(categoryEmoji("city"), categoryEmoji("country"));
});

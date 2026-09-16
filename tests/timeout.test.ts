import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../src/lib/timeout.ts";

class Timeout extends Error {}

test("a promise that never settles is abandoned with the supplied error", async () => {
  // The desktop-client hang: sdk.ready() simply never resolves.
  const never = new Promise<void>(() => {});
  await assert.rejects(withTimeout(never, 20, () => new Timeout("late")), Timeout);
});

test("a promise that settles in time wins and passes its value through", async () => {
  const quick = new Promise<string>((resolve) => setTimeout(() => resolve("ready"), 5));
  assert.equal(await withTimeout(quick, 200, () => new Timeout()), "ready");
});

test("the underlying rejection is kept when it comes first", async () => {
  const failing = Promise.reject(new Error("handshake refused"));
  await assert.rejects(withTimeout(failing, 200, () => new Timeout()), /handshake refused/);
});

test("the timer is cleared once the race is decided, so it never fires afterwards", async () => {
  // Promise.race keeps a handler on the timeout promise, so a leaked timer would
  // not show up as an unhandled rejection. What it does do is fire: count that.
  let fired = 0;
  await withTimeout(Promise.resolve("done"), 10, () => {
    fired++;
    return new Timeout("should never fire");
  });
  await new Promise((resolve) => setTimeout(resolve, 40)); // outlive the deadline
  assert.equal(fired, 0);
});

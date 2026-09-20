/**
 * How long each voting step gets. Shared so the ring on screen and the server's
 * deadline can never drift apart.
 */

/** Nothing to look at yet: the category card itself takes a beat to read. */
const BASE_MS = 4_000;
/** Per answer that can actually be voted on. */
const PER_ANSWER_MS = 2_500;
/** Even one answer gets a moment... */
const MIN_MS = 6_000;
/** ...and a big room never drags: the window closes early once everyone has voted. */
const MAX_MS = 15_000;

/** After the last category: a moment to look the board over before it scores. */
export const REVIEWED_GRACE_MS = 5_000;
/** How long the between-rounds scoreboard stays up. */
export const RESULTS_MS = 5_000;

/**
 * The clock for one category. It scales with the answers on screen, not the number
 * of players: a five-player room where only two people answered has no more to read
 * than a two-player one.
 */
export function categoryVoteMs(votableAnswers: number): number {
  if (votableAnswers <= 0) return MIN_MS; // skipped almost at once anyway
  return Math.min(MAX_MS, Math.max(MIN_MS, BASE_MS + PER_ANSWER_MS * votableAnswers));
}

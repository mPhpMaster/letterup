/**
 * Derived numbers for the profile card. Pure functions, shared by the server (which
 * builds the view) and the tests.
 */

/** Points needed per level. XP is simply lifetime points. */
export const XP_PER_LEVEL = 500;

export function levelFromPoints(totalPoints: number): { level: number; xp: number; needed: number } {
  const points = Math.max(0, Math.floor(totalPoints));
  return { level: Math.floor(points / XP_PER_LEVEL) + 1, xp: points % XP_PER_LEVEL, needed: XP_PER_LEVEL };
}

export type Tier = "legendary" | "elite" | "pro";

/** A badge from the global rank: top 3, top 10, top 50. Nothing below that. */
export function tierFromRank(rank: number | null): Tier | null {
  if (rank === null || rank < 1) return null;
  if (rank <= 3) return "legendary";
  if (rank <= 10) return "elite";
  if (rank <= 50) return "pro";
  return null;
}

export interface ResultLike {
  won: boolean;
  tied: boolean;
}

/** A shared first place counts as a win, the same as the lifetime wins counter. */
const isWin = (r: ResultLike) => r.won || r.tied;

/** Results must be oldest first. */
export function winStreaks(results: readonly ResultLike[]): { current: number; longest: number } {
  let run = 0;
  let longest = 0;
  for (const r of results) {
    run = isWin(r) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { current: run, longest };
}

/**
 * How the recent scores moved: the later half's average against the earlier half's,
 * as a whole percent. Null until there are at least four games or the earlier half
 * averaged zero (no baseline to compare with).
 */
export function trendPercent(scores: readonly number[]): number | null {
  if (scores.length < 4) return null;
  const half = Math.floor(scores.length / 2);
  const avg = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const before = avg(scores.slice(0, half));
  const after = avg(scores.slice(scores.length - half));
  if (before <= 0) return null;
  return Math.round(((after - before) / before) * 100);
}

/** Whole percent, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** The most common starting letters among a player's accepted words. */
export function topLetters(letters: readonly string[], count = 4): string[] {
  const tally = new Map<string, number>();
  for (const l of letters) tally.set(l, (tally.get(l) ?? 0) + 1);
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([l]) => l);
}

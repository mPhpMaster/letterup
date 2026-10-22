/**
 * Local answer check against the bundled word lists. Pure (lists and normalizer are
 * passed in) so it can be tested without the app's module aliases.
 *
 * - An exact hit (after the game's normalization, with or without a leading "ال" /
 *   "the ") verifies the answer: it counts without a vote.
 * - A near miss ("palastine") only *suggests* the spelling. The answer keeps its vote,
 *   because a near miss can be a different real word ("house" is one letter from
 *   "horse"), and a verified answer can't be voted down.
 */

export interface CategoryList {
  readonly en: readonly string[];
  readonly ar: readonly string[];
}
export type Lists = Readonly<Record<string, CategoryList>>;

export type LocalResult = { kind: "exact"; canonical: string } | { kind: "suggest"; canonical: string } | null;

const ARABIC = /[؀-ۿ]/;

function stripArticle(normalized: string): string {
  if (normalized.startsWith("ال") && normalized.length > 3) return normalized.slice(2);
  if (normalized.startsWith("the ")) return normalized.slice(4);
  return normalized;
}

/**
 * Edit distance where swapping two neighbouring letters counts as one edit
 * ("denamrk" -> "denmark"), giving up (returning max + 1) once it can't stay within `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let prevMin = 0;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], before[j - 2] + 1);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    // A swap reaches back two rows, so stop only when both rows are over the limit.
    if (rowMin > max && prevMin > max) return max + 1;
    before = prev;
    prev = cur;
    prevMin = rowMin;
  }
  return prev[b.length];
}

/** How far a typo may be from the real word: none for short words, 1 from 6 letters, 2 from 9. */
function allowedDistance(length: number): number {
  return length >= 9 ? 2 : length >= 6 ? 1 : 0;
}

export function createLocalChecker(lists: Lists, normalize: (s: string) => string) {
  // category -> lang -> normalized (article stripped) -> display form from the list
  const index = new Map<string, { en: Map<string, string>; ar: Map<string, string> }>();
  // every normalized word in any category, to refuse suggestions that are real words elsewhere
  const everywhere = new Set<string>();
  for (const [category, list] of Object.entries(lists)) {
    const entry = { en: new Map<string, string>(), ar: new Map<string, string>() };
    for (const lang of ["en", "ar"] as const) {
      for (const word of list[lang]) {
        const key = stripArticle(normalize(word));
        if (!key) continue;
        if (!entry[lang].has(key)) entry[lang].set(key, word);
        everywhere.add(key);
      }
    }
    index.set(category, entry);
  }

  return function check(category: string, value: string): LocalResult {
    const lists = index.get(category);
    if (!lists) return null;
    const key = stripArticle(normalize(value));
    if (!key) return null;
    const map = ARABIC.test(key) ? lists.ar : lists.en;

    const exact = map.get(key);
    if (exact) return { kind: "exact", canonical: exact };

    const max = allowedDistance(key.replace(/\s+/g, "").length);
    if (max === 0 || everywhere.has(key)) return null;
    let best: string | null = null;
    let bestDistance = max + 1;
    let tie = false;
    for (const [candidate, display] of map) {
      if (candidate[0] !== key[0]) continue; // the round letter is fixed; a typo there is a different word
      const d = editDistance(key, candidate, max);
      if (d < bestDistance) {
        bestDistance = d;
        best = display;
        tie = false;
      } else if (d === bestDistance && d <= max && display !== best) {
        tie = true;
      }
    }
    if (!best || bestDistance > max || tie) return null;
    return { kind: "suggest", canonical: best };
  };
}

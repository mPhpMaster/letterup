export type LetterLocale = "en" | "ar";

export const ALPHABETS: Record<LetterLocale, readonly string[]> = {
  en: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  ar: ["أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"],
};

/** Letters with very few common words across categories; skipped when the host enables "skip hard letters". */
export const HARD_LETTERS: Record<LetterLocale, readonly string[]> = {
  en: ["Q", "X", "Z"],
  ar: ["ث", "ذ", "ض", "ظ", "غ"],
};

/**
 * Canonical form used for letter checks and duplicate detection:
 * case-folded, accents/harakat removed, Arabic alef/yaa/taa-marbuta variants unified.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // Latin accents, Arabic harakat, hamza/madda marks on alef
    .normalize("NFC")
    .toLowerCase()
    .replace(/ـ/g, "") // tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Things people put between several answers to hedge: commas (Latin and Arabic),
 * semicolons, slashes, pipes, "&", "+", line breaks, and a spaced "or" / "أو".
 * Hyphens and plain spaces are left alone -- "Guinea-Bissau", "New York" and
 * "Trinidad and Tobago" are single answers.
 */
const LIST_SEPARATOR = /[,\u060C;\u061B/\\|&+\n\r]|\s+(?:or|\u0623\u0648|\u0627\u0648)\s+/iu;

/**
 * One answer per category: when a player lists several ("Philippines, Palestine,
 * Portugal"), only the first counts. `trimmed` says whether anything was dropped.
 */
export function firstAnswer(raw: string): { value: string; trimmed: boolean } {
  const parts = raw.split(LIST_SEPARATOR).map((p) => p.trim()).filter(Boolean);
  const value = parts[0] ?? "";
  return { value, trimmed: parts.length > 1 };
}

/**
 * Whether an answer says anything. Typing only the round letter ("P", "ب") to look
 * busy is not an answer, so anything under two letters counts as blank.
 */
export function isRealAnswer(raw: string): boolean {
  return normalizeAnswer(raw).replace(/\s+/g, "").length >= 2;
}

/** True when the (already normalized) answer starts with the round letter. Leading "ال" / "the " is tolerated. */
export function startsWithLetter(normalized: string, letter: string): boolean {
  const target = normalizeAnswer(letter);
  if (!normalized || !target) return false;
  const candidates = [normalized];
  if (normalized.startsWith("ال") && normalized.length > 2) candidates.push(normalized.slice(2));
  if (normalized.startsWith("the ")) candidates.push(normalized.slice(4));
  return candidates.some((c) => c.startsWith(target));
}

export function pickLetter(
  locale: LetterLocale,
  used: readonly string[],
  excludeHard: boolean,
  random: () => number = Math.random,
): string {
  const base = ALPHABETS[locale].filter((l) => !excludeHard || !HARD_LETTERS[locale].includes(l));
  const fresh = base.filter((l) => !used.includes(l));
  const pool = fresh.length > 0 ? fresh : base;
  return pool[Math.floor(random() * pool.length)];
}

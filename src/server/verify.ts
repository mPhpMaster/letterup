/**
 * Confirm a round's answers before voting opens, and learn from the vote afterwards.
 *
 * Order: bundled word lists (instant) -> what players decided in earlier games (allow /
 * block list) -> cached online results -> Wikidata (within a small time budget). A
 * confirmed answer counts without a vote. One the game doesn't know needs a 👍 to
 * count; a timed-out lookup just goes to the vote as usual. Never throws: if any of
 * this fails, the round is voted on exactly as before.
 */
import { createLocalChecker } from "@/lib/answerCheck";
import { isAnswerValid } from "@/lib/scoring";
import { normalizeAnswer } from "@/lib/letters";
import { WORDLISTS } from "@/lib/wordlists";
import { admin } from "./supabase-admin";
import { CHECKED_ONLINE, checkOnline } from "./wikidata";

const localCheck = createLocalChecker(WORDLISTS, normalizeAnswer);

/** The whole online pass gets this long; voting opens right after. */
const ONLINE_BUDGET_MS = 3000;
/** Parallel Wikidata lookups at once -- polite to a free public service. */
const ONLINE_CONCURRENCY = 6;

const ARABIC = /[؀-ۿ]/;
const langOf = (s: string): "en" | "ar" => (ARABIC.test(s) ? "ar" : "en");

interface PendingAnswer {
  id: string;
  category: string;
  value: string;
  normalized: string;
}
interface Update {
  id: string;
  verified?: boolean;
  verified_as?: string;
  normalized?: string;
  needs_approval?: boolean;
  blocked?: boolean;
}
interface Verdict {
  category: string;
  lang: string;
  normalized: string;
  display: string;
  good: number;
  bad: number;
}

const verdictKey = (category: string, lang: string, normalized: string) => `${category}|${lang}|${normalized}`;

export async function verifyRoundAnswers(roundId: string): Promise<void> {
  try {
    await verify(roundId);
  } catch (err) {
    console.error("[verify]", err instanceof Error ? err.message : err);
  }
}

async function verify(roundId: string): Promise<void> {
  const db = admin();
  const { data, error } = await db
    .from("answers")
    .select("id, category, value, normalized, auto_valid, verified")
    .eq("round_id", roundId)
    .returns<(PendingAnswer & { auto_valid: boolean; verified: boolean })[]>();
  if (error) throw new Error(`answers: ${error.message}`);
  // Only answers that could score: non-blank, right letter, not confirmed yet.
  const pending = data.filter((a) => a.normalized && a.auto_valid && !a.verified);
  if (pending.length === 0) return;

  const verdicts = await loadVerdicts(pending);
  const updates: Update[] = [];
  const online: PendingAnswer[] = [];
  for (const a of pending) {
    const local = localCheck(a.category, a.value);
    if (local?.kind === "exact") {
      // The list's form drives duplicate detection ("رياض" = "الرياض").
      updates.push({ id: a.id, verified: true, verified_as: local.canonical, normalized: normalizeAnswer(local.canonical) });
      continue;
    }
    const v = verdicts.get(verdictKey(a.category, langOf(a.value), a.normalized));
    if (v && v.good > v.bad) {
      updates.push({ id: a.id, verified: true, verified_as: v.display });
    } else if (v && v.bad > v.good) {
      updates.push({ id: a.id, needs_approval: true, blocked: true });
    } else if (local) {
      // Near miss: show the spelling; it isn't the word itself, so it needs a 👍.
      updates.push({ id: a.id, verified_as: local.canonical, normalized: normalizeAnswer(local.canonical), needs_approval: true });
    } else if (CHECKED_ONLINE.includes(a.category)) {
      online.push(a);
    } else {
      updates.push({ id: a.id, needs_approval: true });
    }
  }

  if (online.length > 0) {
    const results = await lookUpOnline(online);
    for (const a of online) {
      const r = results.get(a.id);
      if (r?.known) updates.push({ id: a.id, verified: true, verified_as: r.label ?? a.value });
      else if (r) updates.push({ id: a.id, needs_approval: true });
      // no result: the lookup ran out of time -- the vote decides as before
    }
  }

  await Promise.all(
    updates.map(async ({ id, ...patch }) => {
      const { error: e } = await db.from("answers").update(patch).eq("id", id);
      if (e) console.error("[verify] update", e.message);
    }),
  );
}

async function loadVerdicts(answers: PendingAnswer[]): Promise<Map<string, Verdict>> {
  const { data, error } = await admin()
    .from("answer_verdicts")
    .select("category, lang, normalized, display, good, bad")
    .in("normalized", [...new Set(answers.map((a) => a.normalized))])
    .returns<Verdict[]>();
  if (error) console.error("[verify] verdicts read", error.message);
  return new Map((data ?? []).map((v) => [verdictKey(v.category, v.lang, v.normalized), v]));
}

/** answer id -> online result, for answers checked in time (cache or Wikidata). */
async function lookUpOnline(answers: PendingAnswer[]): Promise<Map<string, { known: boolean; label?: string }>> {
  const db = admin();
  const found = new Map<string, { known: boolean; label?: string }>();
  const key = (a: PendingAnswer) => verdictKey(a.category, langOf(a.value), a.normalized);

  // 1. Cache.
  const { data: cached, error } = await db
    .from("answer_checks")
    .select("category, lang, normalized, known, label")
    .in("normalized", [...new Set(answers.map((a) => a.normalized))])
    .returns<{ category: string; lang: string; normalized: string; known: boolean; label: string | null }[]>();
  if (error) console.error("[verify] cache read", error.message);
  const cache = new Map((cached ?? []).map((c) => [verdictKey(c.category, c.lang, c.normalized), c]));
  const toFetch: PendingAnswer[] = [];
  for (const a of answers) {
    const hit = cache.get(key(a));
    if (!hit) toFetch.push(a);
    else found.set(a.id, { known: hit.known, label: hit.label ?? undefined });
  }

  // 2. Wikidata, a few at a time, inside the budget. Same word twice = one lookup.
  const unique = [...new Map(toFetch.map((a) => [key(a), a])).values()];
  const deadline = Date.now() + ONLINE_BUDGET_MS;
  const results = new Map<string, { known: boolean; label?: string }>();
  let next = 0;
  async function worker() {
    while (next < unique.length) {
      const a = unique[next++];
      const left = deadline - Date.now();
      if (left < 400) return;
      try {
        results.set(key(a), await checkOnline(a.category, a.value, langOf(a.value), left));
      } catch {
        // timeout / network: leave it to the vote, and don't cache a non-answer
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ONLINE_CONCURRENCY, unique.length) }, worker));

  for (const a of toFetch) {
    const r = results.get(key(a));
    if (r) found.set(a.id, r);
  }
  if (results.size > 0) {
    const rows = [...results].map(([k, r]) => {
      const [category, lang, normalized] = k.split("|");
      return { category, lang, normalized, known: r.known, label: r.label ?? null };
    });
    const { error: e } = await db.from("answer_checks").upsert(rows, { onConflict: "category,lang,normalized" });
    if (e) console.error("[verify] cache write", e.message);
  }
  return found;
}

interface ScoredAnswer extends PendingAnswer {
  auto_valid: boolean;
  verified: boolean;
  needs_approval: boolean;
  blocked: boolean;
  host_verdict: boolean | null;
}

/**
 * After a round is scored, remember what players decided about answers the game
 * didn't already know: approved words join the allow list, rejected ones the block
 * list. Answers nobody voted on teach nothing. Never throws.
 */
export async function recordVerdicts(
  answers: readonly ScoredAnswer[],
  votes: readonly { answerId: string; approve: boolean }[],
  playerCount: number,
): Promise<void> {
  try {
    const rows = new Map<string, Verdict>();
    for (const a of answers) {
      if (!a.normalized || !a.auto_valid || a.verified) continue;
      const own = votes.filter((v) => v.answerId === a.id);
      if (a.host_verdict === null && own.length === 0) continue;
      const good = isAnswerValid(
        { id: a.id, playerId: "", category: a.category, normalized: a.normalized, autoValid: true, hostVerdict: a.host_verdict, needsApproval: a.needs_approval },
        own,
        playerCount,
      );
      const lang = langOf(a.value);
      const k = verdictKey(a.category, lang, a.normalized);
      const row = rows.get(k) ?? { category: a.category, lang, normalized: a.normalized, display: a.value.trim(), good: 0, bad: 0 };
      if (good) row.good++;
      else row.bad++;
      rows.set(k, row);
    }
    if (rows.size === 0) return;
    const { error } = await admin().rpc("record_answer_verdicts", { p_rows: [...rows.values()] });
    if (error) console.error("[verify] verdicts write", error.message);
  } catch (err) {
    console.error("[verify] verdicts", err instanceof Error ? err.message : err);
  }
}

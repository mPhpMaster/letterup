/**
 * Confirm a round's answers before voting opens, so known ones skip the vote.
 *
 * Order: bundled word lists (instant) -> cached online results -> Wikidata (within a
 * small time budget; whatever doesn't finish in time just goes to the vote and is
 * cached for next time). Never rejects anything, and never throws: if any of this
 * fails, the round is voted on exactly as before.
 */
import { createLocalChecker } from "@/lib/answerCheck";
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
  verified: boolean;
  verified_as: string;
  normalized: string;
}

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

  const updates: Update[] = [];
  const online: PendingAnswer[] = [];
  for (const a of pending) {
    const local = localCheck(a.category, a.value);
    if (local) {
      // Exact: counts without a vote. Near miss: the spelling is shown, the vote stays.
      // Either way the list's form drives duplicate detection ("رياض" = "الرياض").
      updates.push({ id: a.id, verified: local.kind === "exact", verified_as: local.canonical, normalized: normalizeAnswer(local.canonical) });
    } else if (CHECKED_ONLINE.includes(a.category)) {
      online.push(a);
    }
  }

  if (online.length > 0) {
    const known = await lookUpOnline(online);
    for (const a of online) {
      const hit = known.get(a.id);
      if (hit) updates.push({ id: a.id, verified: true, verified_as: hit, normalized: a.normalized });
    }
  }

  await Promise.all(
    updates.map(async (u) => {
      const { error: e } = await db.from("answers").update({ verified: u.verified, verified_as: u.verified_as, normalized: u.normalized }).eq("id", u.id);
      if (e) console.error("[verify] update", e.message);
    }),
  );
}

/** answer id -> display label, for answers Wikidata (or the cache) knows. */
async function lookUpOnline(answers: PendingAnswer[]): Promise<Map<string, string>> {
  const db = admin();
  const found = new Map<string, string>();
  const key = (a: PendingAnswer) => `${a.category}|${langOf(a.value)}|${a.normalized}`;

  // 1. Cache.
  const { data: cached, error } = await db
    .from("answer_checks")
    .select("category, lang, normalized, known, label")
    .in("normalized", [...new Set(answers.map((a) => a.normalized))])
    .returns<{ category: string; lang: string; normalized: string; known: boolean; label: string | null }[]>();
  if (error) console.error("[verify] cache read", error.message);
  const cache = new Map((cached ?? []).map((c) => [`${c.category}|${c.lang}|${c.normalized}`, c]));
  const toFetch: PendingAnswer[] = [];
  for (const a of answers) {
    const hit = cache.get(key(a));
    if (!hit) toFetch.push(a);
    else if (hit.known) found.set(a.id, hit.label ?? a.value);
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
    if (r?.known) found.set(a.id, r.label ?? a.value);
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

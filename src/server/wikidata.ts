/**
 * Online fallback for answers the local word lists don't know: ask Wikidata whether
 * something with exactly this name belongs to the category.
 *
 * Free, no key, works in Arabic as well as English. Only ever used to *approve* an
 * answer -- a miss sends the answer to the players' vote, never rejects it.
 */
import { normalizeAnswer } from "@/lib/letters";

const UA = "LetterUp/1.0 (https://letterup-two.vercel.app; word game answer check)";

/**
 * Classes an item may be an instance (or a few levels of subclass) of. Paths are
 * bounded on purpose: an unbounded `wdt:P279*` walk times out on the public endpoint.
 * Animals, plants, colours, sports, jobs and objects are left to the word lists.
 */
const CLASSES: Record<string, readonly string[]> = {
  // country, sovereign state, state, city, big city, capital, human settlement, continent, metropolis
  country: ["Q6256", "Q3624078", "Q7275", "Q515", "Q1549591", "Q5119", "Q486972", "Q5107", "Q200250"],
  // human, given name, male/female given name, unisex given name, family name
  human: ["Q5", "Q202444", "Q12308941", "Q11879590", "Q3409032", "Q101352"],
  // food, dish, drink, beverage, food ingredient, dessert, bread
  food: ["Q2095", "Q746549", "Q40050", "Q25403900", "Q182940", "Q7802"],
  // brand, business, company, enterprise, automobile manufacturer, brand of product
  brand: ["Q431289", "Q4830453", "Q783794", "Q6881511", "Q786820", "Q167270"],
  // film, television series, animated film, film series, anime television series
  movie: ["Q11424", "Q5398426", "Q202866", "Q24856", "Q63952888"],
};

export const CHECKED_ONLINE = Object.keys(CLASSES);

async function getJson(url: string, ms: number): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "user-agent": UA, accept: "application/json" } });
    if (!res.ok) throw new Error(`wikidata ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface SearchHit {
  id: string;
  label?: string;
  match?: { text?: string };
}

/** Items whose label or alias is exactly the answer (after the game's own normalization). */
async function exactItems(word: string, lang: "en" | "ar", ms: number): Promise<{ id: string; label: string }[]> {
  const url =
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&type=item&limit=10&format=json" +
    `&language=${lang}&uselang=${lang}&search=${encodeURIComponent(word)}`;
  const data = (await getJson(url, ms)) as { search?: SearchHit[] };
  const want = normalizeAnswer(word);
  return (data.search ?? [])
    .filter((h) => normalizeAnswer(h.match?.text ?? h.label ?? "") === want)
    .map((h) => ({ id: h.id, label: h.label ?? word }));
}

/** Does any of these items sit in one of the classes (up to three subclass hops)? */
async function anyInClasses(ids: readonly string[], classes: readonly string[], ms: number): Promise<string | null> {
  const items = ids.map((i) => `wd:${i}`).join(" ");
  const cls = classes.map((c) => `wd:${c}`).join(" ");
  const q = `SELECT ?item WHERE {
    VALUES ?item { ${items} } VALUES ?cls { ${cls} }
    { ?item wdt:P31/wdt:P279?/wdt:P279?/wdt:P279? ?cls . } UNION { ?item wdt:P279/wdt:P279?/wdt:P279? ?cls . }
  } LIMIT 1`;
  const data = (await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, ms)) as {
    results?: { bindings?: { item?: { value?: string } }[] };
  };
  const hit = data.results?.bindings?.[0]?.item?.value;
  return hit ? hit.slice(hit.lastIndexOf("/") + 1) : null;
}

export interface OnlineVerdict {
  /** true: Wikidata knows it in this category. false: it found nothing (not proof it is wrong). */
  known: boolean;
  /** Wikidata's own label for the item, for display. */
  label?: string;
}

/**
 * Look the answer up. Throws on network trouble or timeout -- callers treat that as
 * "unknown" and leave the answer to the vote.
 */
export async function checkOnline(category: string, word: string, lang: "en" | "ar", ms = 2500): Promise<OnlineVerdict> {
  const classes = CLASSES[category];
  if (!classes) return { known: false };
  const deadline = Date.now() + ms;
  const items = await exactItems(word, lang, ms);
  if (items.length === 0) return { known: false };
  const left = Math.max(300, deadline - Date.now());
  const hit = await anyInClasses(
    items.map((i) => i.id),
    classes,
    left,
  );
  if (!hit) return { known: false };
  return { known: true, label: items.find((i) => i.id === hit)?.label };
}

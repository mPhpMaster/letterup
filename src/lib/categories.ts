export type Tone = "brand" | "mint" | "grape" | "sky" | "accent";

export const CATEGORIES = [
  { id: "human", emoji: "🧑", tone: "brand" },
  { id: "animal", emoji: "🐾", tone: "mint" },
  { id: "plant", emoji: "🌿", tone: "grape" },
  { id: "object", emoji: "📦", tone: "sky" },
  // One slot for places: a country or a city both count.
  { id: "country", emoji: "🌍", tone: "accent" },
  { id: "food", emoji: "🍕", tone: "brand" },
  { id: "brand", emoji: "🏷️", tone: "grape" },
  { id: "job", emoji: "🧰", tone: "mint" },
  { id: "movie", emoji: "🎬", tone: "grape" },
  { id: "color", emoji: "🎨", tone: "accent" },
  { id: "sport", emoji: "⚽", tone: "mint" },
] as const satisfies readonly { id: string; emoji: string; tone: Tone }[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS: readonly string[] = CATEGORIES.map((c) => c.id);

/** Ids that were folded into another category; old settings may still hold them. */
const MERGED_INTO: Readonly<Partial<Record<string, CategoryId>>> = { city: "country" };

/** Known ids in canonical order, with merged ones mapped onto their replacement and deduped. */
export function normalizeCategories(list: readonly string[]): string[] {
  const mapped: string[] = list.map((id) => MERGED_INTO[id] ?? id);
  return CATEGORY_IDS.filter((id) => mapped.includes(id));
}

export const DEFAULT_CATEGORIES: CategoryId[] = ["human", "animal", "plant", "object"];

export function categoryEmoji(id: string): string {
  return CATEGORIES.find((c) => c.id === (MERGED_INTO[id] ?? id))?.emoji ?? "❓";
}

export function categoryTone(id: string): Tone {
  return CATEGORIES.find((c) => c.id === (MERGED_INTO[id] ?? id))?.tone ?? "sky";
}

/** Soft tint behind a category's emoji. */
export const toneBg: Record<Tone, string> = {
  brand: "bg-brand/15",
  mint: "bg-mint/15",
  grape: "bg-grape/15",
  sky: "bg-sky/15",
  accent: "bg-accent/25",
};

/** Solid fill with readable text, for avatars and podium blocks. */
export const toneSolid: Record<Tone, string> = {
  brand: "bg-brand text-white",
  mint: "bg-mint text-ink",
  grape: "bg-grape text-white",
  sky: "bg-sky text-white",
  accent: "bg-accent text-ink",
};

export const TONES: readonly Tone[] = ["brand", "mint", "grape", "sky", "accent"];

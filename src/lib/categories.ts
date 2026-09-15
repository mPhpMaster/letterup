export const CATEGORIES = [
  { id: "human", emoji: "🧑" },
  { id: "animal", emoji: "🦁" },
  { id: "plant", emoji: "🌿" },
  { id: "object", emoji: "📦" },
  { id: "country", emoji: "🌍" },
  { id: "city", emoji: "🏙️" },
  { id: "food", emoji: "🍲" },
  { id: "brand", emoji: "🏷️" },
  { id: "job", emoji: "💼" },
  { id: "movie", emoji: "🎬" },
  { id: "color", emoji: "🎨" },
  { id: "sport", emoji: "⚽" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS: readonly string[] = CATEGORIES.map((c) => c.id);
export const DEFAULT_CATEGORIES: CategoryId[] = ["human", "animal", "plant", "object"];

export function categoryEmoji(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.emoji ?? "❓";
}

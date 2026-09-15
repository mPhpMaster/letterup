/** Standard competition ranking ("1, 1, 3"), highest score first. Stable for equal scores. */
export function rankByScore<T extends { score: number }>(items: readonly T[]): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return sorted.map((item, i) => ({
    ...item,
    rank: sorted.findIndex((other) => other.score === item.score) + 1,
  }));
}

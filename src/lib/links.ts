/**
 * Outbound links the game offers.
 *
 * The tip page is public by nature -- it ships inside the page either way -- so it
 * lives here rather than in a secret. Set NEXT_PUBLIC_DONATE_URL to point somewhere
 * else, or to an empty string to drop the link entirely.
 */
const configured = process.env.NEXT_PUBLIC_DONATE_URL;

export const DONATE_URL = (configured === undefined ? "https://paypal.me/mfsafadi" : configured).trim();

export interface GameLink {
  id: string;
  emoji: string;
  name: { en: string; ar: string };
  blurb: { en: string; ar: string };
  /** Empty while a game has nowhere to send people yet -- it is listed as "soon". */
  url: string;
}

/**
 * The developer's other games, shown on the home screen and after a match.
 * A game with no URL yet is still listed, marked "soon" and not clickable.
 * (Keeping that path: the next game can go in before it has an address.)
 */
export const OTHER_GAMES: GameLink[] = [
  {
    id: "guess-the-language",
    emoji: "💻",
    name: { en: "Guess the Language", ar: "خمّن اللغة" },
    blurb: {
      en: "A code snippet appears — name the language. Seven quiz modes and a live leaderboard.",
      ar: "يظهر كود وعليك تخمين اللغة. سبعة أنماط ولوحة صدارة مباشرة.",
    },
    url: "https://guess-the-language-chi.vercel.app",
  },
  {
    id: "maqlab",
    emoji: "🎭",
    name: { en: "MAQLAB", ar: "مقلب" },
    blurb: {
      en: "A party game for the whole room, in Arabic or English.",
      ar: "لعبة حفلات جماعية بالعربي أو الإنجليزي.",
    },
    url: "https://maqlab.onrender.com",
  },
];

export const liveGames = (): GameLink[] => OTHER_GAMES.filter((g) => g.url);

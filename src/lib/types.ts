import type { LetterLocale } from "./letters";

export type GameStatus = "lobby" | "playing" | "voting" | "results" | "finished";
export type RoundStatus = "playing" | "voting" | "scored";

export interface PlayerView {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  score: number;
  ready: boolean;
  online: boolean;
  isHost: boolean;
}

export interface SettingsView {
  roundSeconds: number;
  totalRounds: number;
  categories: string[];
  letterLocale: LetterLocale;
  excludeHardLetters: boolean;
}

export interface AnswerView {
  id: string;
  playerId: string;
  category: string;
  value: string;
  normalized: string;
  autoValid: boolean;
  hostVerdict: boolean | null;
  isValid: boolean | null;
  points: number;
  approvals: number;
  rejections: number;
  myVote: boolean | null;
}

export interface RoundView {
  id: string;
  number: number;
  letter: string;
  letterLocale: LetterLocale;
  categories: string[];
  status: RoundStatus;
  startedAt: number;
  endsAt: number;
  submittedPlayerIds: string[];
  /** The current player's own answers (always available, used to restore drafts). */
  myAnswers: Record<string, string>;
  /** Everyone's answers — only sent once the round is closed. */
  answers: AnswerView[];
  /** Votes, only for computing a live score preview during voting. */
  votes: { answerId: string; approve: boolean }[];
}

export interface GameState {
  serverNow: number;
  game: {
    id: string;
    instanceId: string;
    status: GameStatus;
    hostUserId: string | null;
    currentRound: number;
    version: number;
  };
  me: { playerId: string; userId: string };
  settings: SettingsView;
  players: PlayerView[];
  round: RoundView | null;
}

export interface SessionUser {
  userId: string;
  username: string;
  avatarUrl: string | null;
  kind: "discord" | "guest";
}

import type { LetterLocale } from "./letters";

export type GameStatus = "lobby" | "playing" | "voting" | "results" | "finished";
export type RoundStatus = "playing" | "voting" | "scored";
export type GameOrigin = "discord" | "web";

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
    /** Short code used to join from a browser; null for Discord Activity rooms. */
    roomCode: string | null;
    origin: GameOrigin;
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

/** Lifetime stats shown when you tap a player. */
export interface ProfileView {
  userId: string;
  username: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  wins: number;
  roundsPlayed: number;
  totalPoints: number;
  bestScore: number;
  /** Average points per scored round, rounded. */
  averagePerRound: number;
  online: boolean;
  isMe: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
  /** Room they are currently playing in, when it can still be joined. */
  currentRoomCode: string | null;
  /** Share of finished games won, 0–100. */
  winRate: number;
  averagePerGame: number;
  followers: number;
  following: number;
  lastSeenAt: number;
  isBanned: boolean;
  banReason: string | null;
}

export interface FriendView {
  userId: string;
  username: string;
  avatarUrl: string | null;
  online: boolean;
  isFollowedBy: boolean;
  currentRoomCode: string | null;
  /** True once you've sent them an invite to your current room. */
  invited: boolean;
}

export interface InviteView {
  id: string;
  gameId: string;
  roomCode: string | null;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  createdAt: number;
}

export interface RoomSummary {
  roomCode: string;
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  playerCount: number;
  hasPassword: boolean;
  hostUsername: string | null;
  updatedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  wins: number;
  gamesPlayed: number;
  roundsPlayed: number;
  bestScore: number;
  averagePerRound: number;
}

export interface AdminSuggestion {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: number;
  handled: boolean;
}

export interface AdminReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedName: string;
  reason: string;
  createdAt: number;
  handled: boolean;
}

export interface AdminState {
  suggestions: AdminSuggestion[];
  reports: AdminReport[];
  banned: { userId: string; username: string; avatarUrl: string | null; bannedAt: number; reason: string | null }[];
}

export interface SearchResultView {
  userId: string;
  username: string;
  avatarUrl: string | null;
  online: boolean;
  isFollowing: boolean;
}

export interface SocialState {
  me: ProfileView;
  friends: FriendView[];
  invites: InviteView[];
}

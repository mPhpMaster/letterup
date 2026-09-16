import { admin } from "./supabase-admin";
import type { LeaderboardEntry, RoomSummary } from "@/lib/types";

interface RoomRow {
  room_code: string;
  status: string;
  current_round: number;
  total_rounds: number;
  player_count: number;
  has_password: boolean;
  host_username: string | null;
  updated_at: string;
}

/** Open browser rooms for the home screen, newest activity first. */
export async function listRooms(limit = 30): Promise<RoomSummary[]> {
  const { data, error } = await admin().rpc("list_rooms", { p_limit: limit });
  if (error) throw new Error(`rooms: ${error.message}`);
  return (data as RoomRow[])
    .filter((r) => r.player_count > 0)
    .map((r) => ({
      roomCode: r.room_code,
      status: r.status as RoomSummary["status"],
      currentRound: r.current_round,
      totalRounds: r.total_rounds,
      playerCount: r.player_count,
      hasPassword: r.has_password,
      hostUsername: r.host_username,
      updatedAt: Date.parse(r.updated_at),
    }));
}

interface LeaderRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  wins: number;
  games_played: number;
  rounds_played: number;
  best_score: number;
  last_seen_at: string;
}

/** Global ranking: most points, then most wins. Banned players are excluded in SQL. */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await admin().rpc("leaderboard", { p_limit: limit });
  if (error) throw new Error(`leaderboard: ${error.message}`);
  return (data as LeaderRow[]).map((row, i) => ({
    rank: i + 1,
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    totalPoints: row.total_points,
    wins: row.wins,
    gamesPlayed: row.games_played,
    roundsPlayed: row.rounds_played,
    bestScore: row.best_score,
    averagePerRound: row.rounds_played > 0 ? Math.round(row.total_points / row.rounds_played) : 0,
  }));
}

import { admin } from "./supabase-admin";
import { HttpError } from "./errors";
import type { AdminReport, AdminState, AdminSuggestion, SessionUser } from "@/lib/types";

/** Discord user ids from ADMIN_USER_IDS. Everything admin-only is gated on this list. */
export function adminIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export const isAdmin = (userId: string): boolean => adminIds().includes(userId);

export function assertAdmin(user: SessionUser): void {
  if (!isAdmin(user.userId)) throw new HttpError(403, "Admins only");
}

/** Players may send feedback from the home screen; only admins ever read it. */
export async function createSuggestion(user: SessionUser, body: string): Promise<void> {
  const text = body.trim();
  if (text.length < 3 || text.length > 2000) throw new HttpError(400, "Write between 3 and 2000 characters");
  const { error } = await admin()
    .from("suggestions")
    .insert({ user_id: user.userId, username: user.username.slice(0, 64), body: text });
  if (error) throw new Error(`suggestion: ${error.message}`);
}

/** Report a player from their profile or the leaderboard. */
export async function createReport(user: SessionUser, targetId: string, reason: string): Promise<void> {
  if (targetId === user.userId) throw new HttpError(400, "You can't report yourself");
  const text = reason.trim();
  if (text.length < 3 || text.length > 1000) throw new HttpError(400, "Write between 3 and 1000 characters");

  const target = await admin().from("profiles").select("username").eq("user_id", targetId).maybeSingle<{ username: string }>();
  if (target.error) throw new Error(`report: ${target.error.message}`);
  if (!target.data) throw new HttpError(404, "No such player");

  const { error } = await admin().from("reports").insert({
    reporter_id: user.userId,
    reporter_name: user.username.slice(0, 64),
    reported_user_id: targetId,
    reported_name: target.data.username,
    reason: text,
  });
  if (error) throw new Error(`report: ${error.message}`);
}

interface SuggestionRow {
  id: string;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
  handled_at: string | null;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string;
  reported_name: string;
  reason: string;
  created_at: string;
  handled_at: string | null;
}

/** The admin panel: latest suggestions, reports and everyone currently banned. */
export async function getAdminState(user: SessionUser): Promise<AdminState> {
  assertAdmin(user);
  const db = admin();
  const [suggestions, reports, banned] = await Promise.all([
    db.from("suggestions").select("*").order("created_at", { ascending: false }).limit(100).returns<SuggestionRow[]>(),
    db.from("reports").select("*").order("created_at", { ascending: false }).limit(100).returns<ReportRow[]>(),
    db
      .from("profiles")
      .select("user_id, username, avatar_url, banned_at, ban_reason")
      .not("banned_at", "is", null)
      .order("banned_at", { ascending: false })
      .limit(100)
      .returns<{ user_id: string; username: string; avatar_url: string | null; banned_at: string; ban_reason: string | null }[]>(),
  ]);
  if (suggestions.error) throw new Error(`suggestions: ${suggestions.error.message}`);
  if (reports.error) throw new Error(`reports: ${reports.error.message}`);
  if (banned.error) throw new Error(`bans: ${banned.error.message}`);

  return {
    suggestions: suggestions.data.map<AdminSuggestion>((s) => ({
      id: s.id,
      userId: s.user_id,
      username: s.username,
      body: s.body,
      createdAt: Date.parse(s.created_at),
      handled: s.handled_at !== null,
    })),
    reports: reports.data.map<AdminReport>((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      reporterName: r.reporter_name,
      reportedUserId: r.reported_user_id,
      reportedName: r.reported_name,
      reason: r.reason,
      createdAt: Date.parse(r.created_at),
      handled: r.handled_at !== null,
    })),
    banned: banned.data.map((b) => ({
      userId: b.user_id,
      username: b.username,
      avatarUrl: b.avatar_url,
      bannedAt: Date.parse(b.banned_at),
      reason: b.ban_reason,
    })),
  };
}

export async function markHandled(user: SessionUser, table: "suggestions" | "reports", id: string): Promise<void> {
  assertAdmin(user);
  const { error } = await admin().from(table).update({ handled_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`${table}: ${error.message}`);
}

/** Ban or unban a player. Banned players can't join or create rooms. */
export async function setBanned(user: SessionUser, targetId: string, banned: boolean, reason?: string): Promise<void> {
  assertAdmin(user);
  if (isAdmin(targetId)) throw new HttpError(400, "Admins can't be banned");
  const { error } = await admin()
    .from("profiles")
    .update(
      banned
        ? { banned_at: new Date().toISOString(), ban_reason: reason?.slice(0, 500) ?? null, banned_by: user.userId }
        : { banned_at: null, ban_reason: null, banned_by: null },
    )
    .eq("user_id", targetId);
  if (error) throw new Error(`ban: ${error.message}`);
}

/** Throws if this player is banned — called before joining or creating a room. */
export async function assertNotBanned(userId: string): Promise<void> {
  const { data, error } = await admin()
    .from("profiles")
    .select("banned_at, ban_reason")
    .eq("user_id", userId)
    .maybeSingle<{ banned_at: string | null; ban_reason: string | null }>();
  if (error) throw new Error(`ban check: ${error.message}`);
  if (data?.banned_at) throw new HttpError(403, data.ban_reason ? `You are banned: ${data.ban_reason}` : "You are banned from LetterUp");
}

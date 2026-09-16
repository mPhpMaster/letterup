import { admin } from "./supabase-admin";
import { HttpError } from "./game";
import type { FriendView, InviteView, ProfileView, SearchResultView, SessionUser, SocialState } from "@/lib/types";

const ONLINE_MS = 60_000;
const INVITE_TTL_MS = 2 * 60 * 60 * 1000;

interface ProfileRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  games_played: number;
  wins: number;
  rounds_played: number;
  total_points: number;
  best_score: number;
  last_seen_at: string;
}

/** Keeps the cross-game profile in step with the Discord display name/avatar. */
export async function touchProfile(user: SessionUser): Promise<void> {
  const { error } = await admin()
    .from("profiles")
    .upsert(
      {
        user_id: user.userId,
        username: user.username.slice(0, 64),
        avatar_url: user.avatarUrl,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`profile: ${error.message}`);
}

async function loadProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await admin().from("profiles").select("*").eq("user_id", userId).maybeSingle<ProfileRow>();
  if (error) throw new Error(`profile: ${error.message}`);
  if (!data) throw new HttpError(404, "No profile yet");
  return data;
}

const isOnline = (row: { last_seen_at: string }, now: number) => now - Date.parse(row.last_seen_at) < ONLINE_MS;

/** The room a user is currently in, if it is still joinable (not finished). */
async function joinableRooms(userIds: string[]): Promise<Map<string, string | null>> {
  const rooms = new Map<string, string | null>();
  if (userIds.length === 0) return rooms;
  const { data, error } = await admin()
    .from("players")
    .select("user_id, last_seen_at, games!inner(room_code, status)")
    .in("user_id", userIds)
    .is("kicked_at", null)
    .neq("games.status", "finished")
    .returns<{ user_id: string; last_seen_at: string; games: { room_code: string | null; status: string } }[]>();
  if (error) throw new Error(`rooms: ${error.message}`);
  const now = Date.now();
  for (const row of data) {
    if (!isOnline(row, now) || !row.games.room_code) continue;
    rooms.set(row.user_id, row.games.room_code);
  }
  return rooms;
}

function toProfileView(
  row: ProfileRow,
  opts: { isMe: boolean; isFollowing: boolean; isFollowedBy: boolean; roomCode: string | null; now: number },
): ProfileView {
  return {
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    gamesPlayed: row.games_played,
    wins: row.wins,
    roundsPlayed: row.rounds_played,
    totalPoints: row.total_points,
    bestScore: row.best_score,
    averagePerRound: row.rounds_played > 0 ? Math.round(row.total_points / row.rounds_played) : 0,
    online: isOnline(row, opts.now),
    isMe: opts.isMe,
    isFollowing: opts.isFollowing,
    isFollowedBy: opts.isFollowedBy,
    currentRoomCode: opts.roomCode,
  };
}

export async function getProfile(viewer: SessionUser, targetId: string): Promise<ProfileView> {
  const db = admin();
  const [row, following, followedBy, rooms] = await Promise.all([
    loadProfile(targetId),
    db.from("follows").select("followee_id").eq("follower_id", viewer.userId).eq("followee_id", targetId).maybeSingle(),
    db.from("follows").select("follower_id").eq("follower_id", targetId).eq("followee_id", viewer.userId).maybeSingle(),
    joinableRooms([targetId]),
  ]);
  return toProfileView(row, {
    isMe: targetId === viewer.userId,
    isFollowing: !!following.data,
    isFollowedBy: !!followedBy.data,
    roomCode: rooms.get(targetId) ?? null,
    now: Date.now(),
  });
}

export async function setFollow(viewer: SessionUser, targetId: string, follow: boolean): Promise<void> {
  if (targetId === viewer.userId) throw new HttpError(400, "You can't follow yourself");
  const db = admin();
  if (!follow) {
    const { error } = await db.from("follows").delete().eq("follower_id", viewer.userId).eq("followee_id", targetId);
    if (error) throw new Error(`unfollow: ${error.message}`);
    return;
  }
  await loadProfile(targetId); // 404s for unknown users
  const { error } = await db
    .from("follows")
    .upsert({ follower_id: viewer.userId, followee_id: targetId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  if (error) throw new Error(`follow: ${error.message}`);
}

export async function removeFollow(viewer: SessionUser, targetId: string): Promise<void> {
  await setFollow(viewer, targetId, false);
}

/** Everything the friends drawer and the invites badge need. */
export async function getSocialState(viewer: SessionUser, gameId?: string | null): Promise<SocialState> {
  const db = admin();
  await touchProfile(viewer);
  const now = Date.now();

  const [meRow, followingRes, followersRes, invitesRes, sentRes] = await Promise.all([
    loadProfile(viewer.userId),
    db.from("follows").select("followee_id").eq("follower_id", viewer.userId).returns<{ followee_id: string }[]>(),
    db.from("follows").select("follower_id").eq("followee_id", viewer.userId).returns<{ follower_id: string }[]>(),
    db
      .from("room_invites")
      .select("id, game_id, from_user_id, created_at, games!inner(room_code, status)")
      .eq("to_user_id", viewer.userId)
      .gt("created_at", new Date(now - INVITE_TTL_MS).toISOString())
      .order("created_at", { ascending: false })
      .returns<{ id: string; game_id: string; from_user_id: string; created_at: string; games: { room_code: string | null; status: string } }[]>(),
    gameId
      ? db.from("room_invites").select("to_user_id").eq("game_id", gameId).eq("from_user_id", viewer.userId).returns<{ to_user_id: string }[]>()
      : Promise.resolve({ data: [] as { to_user_id: string }[], error: null }),
  ]);
  if (followingRes.error) throw new Error(`following: ${followingRes.error.message}`);
  if (followersRes.error) throw new Error(`followers: ${followersRes.error.message}`);
  if (invitesRes.error) throw new Error(`invites: ${invitesRes.error.message}`);
  if (sentRes.error) throw new Error(`sent invites: ${sentRes.error.message}`);

  const followingIds = followingRes.data.map((f) => f.followee_id);
  const followerIds = new Set(followersRes.data.map((f) => f.follower_id));
  const invitedIds = new Set(sentRes.data.map((i) => i.to_user_id));

  const inviterIds = [...new Set(invitesRes.data.map((i) => i.from_user_id))];
  const profileIds = [...new Set([...followingIds, ...inviterIds])];
  const profilesRes = profileIds.length
    ? await db.from("profiles").select("*").in("user_id", profileIds).returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null };
  if (profilesRes.error) throw new Error(`profiles: ${profilesRes.error.message}`);
  const byId = new Map(profilesRes.data.map((p) => [p.user_id, p]));
  const rooms = await joinableRooms(followingIds);

  const friends: FriendView[] = followingIds
    .map((id) => byId.get(id))
    .filter((p): p is ProfileRow => !!p)
    .map((p) => ({
      userId: p.user_id,
      username: p.username,
      avatarUrl: p.avatar_url,
      online: isOnline(p, now),
      isFollowedBy: followerIds.has(p.user_id),
      currentRoomCode: rooms.get(p.user_id) ?? null,
      invited: invitedIds.has(p.user_id),
    }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));

  const invites: InviteView[] = invitesRes.data
    .filter((i) => i.games.status !== "finished")
    .map((i) => {
      const from = byId.get(i.from_user_id);
      return {
        id: i.id,
        gameId: i.game_id,
        roomCode: i.games.room_code,
        fromUserId: i.from_user_id,
        fromUsername: from?.username ?? "Player",
        fromAvatarUrl: from?.avatar_url ?? null,
        createdAt: Date.parse(i.created_at),
      };
    });

  return {
    me: toProfileView(meRow, { isMe: true, isFollowing: false, isFollowedBy: false, roomCode: null, now }),
    friends,
    invites,
  };
}

/** Invite someone you follow into the room you're currently in. */
export async function inviteToRoom(viewer: SessionUser, targetId: string, gameId: string): Promise<void> {
  const db = admin();
  const member = await db.from("players").select("id").eq("game_id", gameId).eq("user_id", viewer.userId).maybeSingle();
  if (member.error) throw new Error(`invite: ${member.error.message}`);
  if (!member.data) throw new HttpError(403, "You are not in this game");

  const already = await db
    .from("players")
    .select("id")
    .eq("game_id", gameId)
    .eq("user_id", targetId)
    .is("kicked_at", null)
    .maybeSingle();
  if (already.error) throw new Error(`invite: ${already.error.message}`);
  if (already.data) throw new HttpError(409, "They are already in this room");

  const follows = await db
    .from("follows")
    .select("followee_id")
    .eq("follower_id", viewer.userId)
    .eq("followee_id", targetId)
    .maybeSingle();
  if (follows.error) throw new Error(`invite: ${follows.error.message}`);
  if (!follows.data) throw new HttpError(403, "You can only invite people you follow");

  const { error } = await db
    .from("room_invites")
    .upsert(
      { game_id: gameId, from_user_id: viewer.userId, to_user_id: targetId, created_at: new Date().toISOString() },
      { onConflict: "game_id,to_user_id" },
    );
  if (error) throw new Error(`invite: ${error.message}`);
}

/** "Add by username": exact-ish lookup so you can follow someone you know the name of. */
export async function searchProfiles(viewer: SessionUser, query: string): Promise<SearchResultView[]> {
  const term = query.trim();
  if (term.length < 3) throw new HttpError(400, "Type at least 3 characters");
  const db = admin();
  const escaped = term.replace(/[%_\\]/g, (c) => `\\${c}`);
  const [rows, following] = await Promise.all([
    db
      .from("profiles")
      .select("user_id, username, avatar_url, last_seen_at")
      .ilike("username", `%${escaped}%`)
      .neq("user_id", viewer.userId)
      .order("last_seen_at", { ascending: false })
      .limit(8)
      .returns<Pick<ProfileRow, "user_id" | "username" | "avatar_url" | "last_seen_at">[]>(),
    db.from("follows").select("followee_id").eq("follower_id", viewer.userId).returns<{ followee_id: string }[]>(),
  ]);
  if (rows.error) throw new Error(`search: ${rows.error.message}`);
  if (following.error) throw new Error(`search: ${following.error.message}`);
  const followingIds = new Set(following.data.map((f) => f.followee_id));
  const now = Date.now();
  return rows.data.map((r) => ({
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url,
    online: isOnline(r, now),
    isFollowing: followingIds.has(r.user_id),
  }));
}

export async function declineInvite(viewer: SessionUser, inviteId: string): Promise<void> {
  const { error } = await admin().from("room_invites").delete().eq("id", inviteId).eq("to_user_id", viewer.userId);
  if (error) throw new Error(`invite: ${error.message}`);
}

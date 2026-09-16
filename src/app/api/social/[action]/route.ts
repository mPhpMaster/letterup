import { HttpError } from "@/server/game";
import { readSession } from "@/server/session";
import { declineInvite, getProfile, getSocialState, inviteToRoom, searchProfiles, setFollow } from "@/server/social";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

function str(value: unknown, field: string, max = 64): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new HttpError(400, `Invalid ${field}`);
  return value.trim();
}

const actions: Record<string, (user: SessionUser, body: Body) => Promise<unknown>> = {
  /** Friends list, pending invites and my own stats. */
  async state(user, body) {
    const gameId = typeof body.gameId === "string" ? body.gameId : null;
    return getSocialState(user, gameId);
  },
  async profile(user, body) {
    return getProfile(user, str(body.userId, "userId"));
  },
  async follow(user, body) {
    if (typeof body.follow !== "boolean") throw new HttpError(400, "Invalid follow");
    await setFollow(user, str(body.userId, "userId"), body.follow);
    return getSocialState(user, typeof body.gameId === "string" ? body.gameId : null);
  },
  async invite(user, body) {
    await inviteToRoom(user, str(body.userId, "userId"), str(body.gameId, "gameId", 40));
    return getSocialState(user, str(body.gameId, "gameId", 40));
  },
  async search(user, body) {
    return { results: await searchProfiles(user, str(body.query, "query", 64)) };
  },
  async dismissInvite(user, body) {
    await declineInvite(user, str(body.inviteId, "inviteId", 40));
    return getSocialState(user, null);
  },
};

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const handler = Object.hasOwn(actions, action) ? actions[action] : undefined;
  if (!handler) return Response.json({ error: "Unknown action" }, { status: 404 });

  const user = await readSession(req);
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  try {
    return Response.json(await handler(user, body));
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
    console.error(`[social/${action}]`, err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

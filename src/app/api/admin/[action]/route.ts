import { getAdminState, isAdmin, markHandled, setBanned } from "@/server/admin";
import { HttpError } from "@/server/errors";
import { readSession } from "@/server/session";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

function str(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new HttpError(400, `Invalid ${field}`);
  return value.trim();
}

const actions: Record<string, (user: SessionUser, body: Body) => Promise<unknown>> = {
  async state(user) {
    return getAdminState(user);
  },
  async handle(user, body) {
    const table = body.table === "reports" ? "reports" : "suggestions";
    await markHandled(user, table, str(body.id, "id", 64));
    return getAdminState(user);
  },
  async ban(user, body) {
    await setBanned(user, str(body.userId, "userId", 64), true, typeof body.reason === "string" ? body.reason : undefined);
    return getAdminState(user);
  },
  async unban(user, body) {
    await setBanned(user, str(body.userId, "userId", 64), false);
    return getAdminState(user);
  },
};

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const handler = Object.hasOwn(actions, action) ? actions[action] : undefined;
  if (!handler) return Response.json({ error: "Unknown action" }, { status: 404 });

  const user = await readSession(req);
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  // Don't even hint that these endpoints exist to non-admins.
  if (!isAdmin(user.userId)) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  try {
    return Response.json(await handler(user, body));
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
    console.error(`[admin/${action}]`, err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

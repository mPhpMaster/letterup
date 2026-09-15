import { actions, HttpError } from "@/server/game";
import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";

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
    console.error(`[game/${action}]`, err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

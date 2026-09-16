import { randomUUID } from "node:crypto";
import { createSession } from "@/server/session";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Local test mode: play in plain browser tabs without Discord. Disabled unless ALLOW_GUEST_MODE=true. */
export async function POST(req: Request) {
  if (process.env.ALLOW_GUEST_MODE !== "true") {
    return Response.json({ error: "Guest mode is disabled" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 32) : "";
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  // Reuse the id the browser already has so reloading keeps your seat.
  const previousId = typeof body?.guestId === "string" && /^guest-[0-9a-f-]{36}$/.test(body.guestId) ? body.guestId : null;
  const user: SessionUser = {
    userId: previousId ?? `guest-${randomUUID()}`,
    username: name,
    avatarUrl: null,
    handle: null,
    kind: "guest",
  };
  return Response.json({ token: await createSession(user), user });
}

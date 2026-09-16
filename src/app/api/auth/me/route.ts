import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Who is signed in on this browser (cookie session)? Used by the web entry screen. */
export async function GET(req: Request) {
  const user = await readSession(req);
  if (!user) return Response.json({ user: null }, { status: 200 });
  return Response.json({ user });
}

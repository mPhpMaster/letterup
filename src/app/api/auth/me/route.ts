import { isAdmin } from "@/server/admin";
import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Who is signed in on this browser (cookie session), and may they open the admin panel? */
export async function GET(req: Request) {
  const user = await readSession(req);
  if (!user) return Response.json({ user: null, isAdmin: false });
  return Response.json({ user, isAdmin: isAdmin(user.userId) });
}

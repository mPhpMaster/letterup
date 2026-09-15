import { admin } from "@/server/supabase-admin";

export const dynamic = "force-dynamic";

/** Daily Vercel Cron: deletes games idle for more than a day (see cleanup_stale_games in the migration). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await admin().rpc("cleanup_stale_games");
  if (error) {
    console.error("[cron/cleanup]", error);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
  return Response.json({ deleted: data });
}

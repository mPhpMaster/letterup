import { clearCookie, SESSION_COOKIE } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Signs the browser out. The session cookie is HttpOnly, so only the server
 * can clear it — the page can't do this on its own.
 */
export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": clearCookie(SESSION_COOKIE) },
  });
}

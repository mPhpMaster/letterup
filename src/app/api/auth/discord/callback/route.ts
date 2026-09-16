import { clearCookie, createSession, exchangeDiscordCode, OAUTH_STATE_COOKIE, originOf, readStateCookie, sessionCookie } from "@/server/session";
import { touchProfile } from "@/server/social";

export const dynamic = "force-dynamic";

/** Discord redirects browser players back here with a code; we set the session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = originOf(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readStateCookie(req);

  const fail = (reason: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${origin}/?error=${encodeURIComponent(reason)}`, "Set-Cookie": clearCookie(OAUTH_STATE_COOKIE) },
    });

  if (!code) return fail(url.searchParams.get("error") ?? "no_code");
  if (!state || !expected || state !== expected) return fail("bad_state");

  try {
    const { user } = await exchangeDiscordCode(code, `${origin}/api/auth/discord/callback`);
    await touchProfile(user);
    const token = await createSession(user);
    const next = state.split("|").slice(1).join("|") || "/";
    return new Response(null, {
      status: 302,
      headers: [
        ["Location", `${origin}${next.startsWith("/") ? next : "/"}`],
        ["Set-Cookie", sessionCookie(token)],
        ["Set-Cookie", clearCookie(OAUTH_STATE_COOKIE)],
      ],
    });
  } catch (err) {
    console.error("[auth/discord/callback]", err);
    return fail("auth_failed");
  }
}

import { createSession, discordUserToSession } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Exchanges the OAuth2 code obtained via `discordSdk.commands.authorize()` for an access token,
 * verifies the user with Discord, and issues our own signed session token.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = body?.code;
  if (typeof code !== "string" || code.length === 0 || code.length > 200) {
    return Response.json({ error: "Missing code" }, { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[auth/discord] Discord credentials are not configured");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!tokenRes.ok) {
    console.error("[auth/discord] token exchange failed", tokenRes.status, await tokenRes.text());
    return Response.json({ error: "Discord authorization failed" }, { status: 401 });
  }
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token: string };

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) {
    return Response.json({ error: "Could not load Discord profile" }, { status: 401 });
  }
  const user = discordUserToSession(await meRes.json());
  const token = await createSession(user);

  return Response.json({ accessToken, token, user });
}

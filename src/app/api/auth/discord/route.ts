import { createSession, exchangeDiscordCode } from "@/server/session";
import { touchProfile } from "@/server/social";

export const dynamic = "force-dynamic";

/**
 * Discord Activity sign-in: exchanges the code from `discordSdk.commands.authorize()`
 * for the player's Discord profile and issues our own signed session token.
 * (Browser players use /api/auth/discord/start instead, which sets a cookie.)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = body?.code;
  if (typeof code !== "string" || code.length === 0 || code.length > 200) {
    return Response.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    const { user, accessToken } = await exchangeDiscordCode(code);
    await touchProfile(user);
    return Response.json({ accessToken, token: await createSession(user), user });
  } catch (err) {
    console.error("[auth/discord]", err);
    const message = err instanceof Error ? err.message : "Discord authorization failed";
    return Response.json({ error: message }, { status: message.includes("configured") ? 500 : 401 });
  }
}

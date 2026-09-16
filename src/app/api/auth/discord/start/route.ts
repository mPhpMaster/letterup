import { randomUUID } from "node:crypto";
import { originOf, stateCookie } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Browser sign-in: send the player to Discord's consent screen.
 * `next` (a path inside this app, e.g. /?room=ABCDE) is carried through the state parameter.
 */
export async function GET(req: Request) {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!clientId) return Response.json({ error: "Server misconfigured" }, { status: 500 });

  const url = new URL(req.url);
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const state = `${randomUUID()}|${next}`;

  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("redirect_uri", `${originOf(req)}/api/auth/discord/callback`);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "none");

  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": stateCookie(state) },
  });
}

import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/lib/types";

const ISSUER = "hapo-activity";
const TTL = "30d";
export const SESSION_COOKIE = "lu_session";
export const OAUTH_STATE_COOKIE = "lu_oauth_state";

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return new TextEncoder().encode(value);
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.username, avatar: user.avatarUrl, kind: user.kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      username: String(payload.name ?? "Player"),
      avatarUrl: typeof payload.avatar === "string" ? payload.avatar : null,
      kind: payload.kind === "guest" ? "guest" : "discord",
    };
  } catch {
    return null;
  }
}

function cookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Discord Activities send the token as a Bearer header (no cookies inside the iframe);
 * browser players get a cookie from the OAuth redirect instead.
 */
export async function readSession(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer ?? cookie(req, SESSION_COOKIE);
  return token ? verifySession(token) : null;
}

export function sessionCookie(token: string, maxAgeSeconds = 30 * 24 * 60 * 60): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // SameSite=Lax survives the Discord OAuth redirect back to our own origin.
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function stateCookie(state: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}

export const readStateCookie = (req: Request) => cookie(req, OAUTH_STATE_COOKIE);

/** Public origin of this deployment, honouring Vercel's proxy headers. */
export function originOf(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export function discordUserToSession(u: DiscordUser): SessionUser {
  const avatarUrl = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> BigInt(22)) % BigInt(6))}.png`;
  return { userId: u.id, username: u.global_name || u.username, avatarUrl, kind: "discord" };
}

/** Exchanges an OAuth2 code for the Discord profile behind it. */
export async function exchangeDiscordCode(code: string, redirectUri?: string): Promise<{ user: SessionUser; accessToken: string }> {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Discord credentials are not configured");

  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code });
  if (redirectUri) body.set("redirect_uri", redirectUri);

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    console.error("[discord] token exchange failed", tokenRes.status, await tokenRes.text());
    throw new Error("Discord authorization failed");
  }
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token: string };

  const meRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!meRes.ok) throw new Error("Could not load Discord profile");
  return { user: discordUserToSession(await meRes.json()), accessToken };
}

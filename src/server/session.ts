import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/lib/types";

const ISSUER = "hapo-activity";
const TTL = "12h";

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

export async function readSession(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
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

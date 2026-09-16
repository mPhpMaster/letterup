import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { postJson } from "./api";
import { withTimeout } from "./timeout";
import type { SessionUser } from "./types";

export type BootStep = "connecting" | "authorizing" | "joining";

/**
 * Discord never answered the Activity handshake. Seen in the desktop client on a
 * first launch: the frame loads, sdk.ready() simply never resolves, and the player
 * is left on a spinner. Relaunching cleared it every time.
 */
export class DiscordHandshakeTimeout extends Error {
  constructor() {
    super("Discord did not answer the Activity handshake");
    this.name = "DiscordHandshakeTimeout";
  }
}

// A healthy handshake lands in a second or two; this is generous on purpose.
const HANDSHAKE_TIMEOUT_MS = 15_000;

export interface DiscordBoot {
  sdk: DiscordSDK;
  token: string;
  user: SessionUser;
  instanceId: string;
  locale: string | null;
}

/** Discord launches Activities with `frame_id` and `instance_id` query params. */
export function isEmbeddedInDiscord(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("frame_id") && params.has("instance_id");
}

export async function bootDiscord(onStep: (step: BootStep) => void): Promise<DiscordBoot> {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_DISCORD_CLIENT_ID is not set");

  // Discord's iframe CSP blocks external hosts; route them through the Activity's URL mappings.
  // These prefixes must match the mappings configured in the Developer Portal (see README).
  const mappings = [{ prefix: "/discord-cdn", target: "cdn.discordapp.com" }];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) mappings.push({ prefix: "/supabase", target: new URL(supabaseUrl).host });
  patchUrlMappings(mappings, { patchFetch: true, patchWebSocket: true, patchXhr: true, patchSrcAttributes: true });

  const sdk = new DiscordSDK(clientId);
  onStep("connecting");
  // Only the handshake gets a deadline. authorize() below can put a consent
  // dialog in front of a first-time player, and that wait is theirs to take.
  await withTimeout(sdk.ready(), HANDSHAKE_TIMEOUT_MS, () => new DiscordHandshakeTimeout());

  onStep("authorizing");
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });
  const auth = await postJson<{ accessToken: string; token: string; user: SessionUser }>("/api/auth/discord", { code });
  await sdk.commands.authenticate({ access_token: auth.accessToken });

  let locale: string | null = null;
  try {
    locale = (await sdk.commands.userSettingsGetLocale()).locale;
  } catch {
    locale = typeof navigator !== "undefined" ? navigator.language : null;
  }

  return { sdk, token: auth.token, user: auth.user, instanceId: sdk.instanceId, locale };
}

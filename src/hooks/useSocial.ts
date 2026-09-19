"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import type { ProfileView, SocialState } from "@/lib/types";

const POLL_MS = 20_000;
/** Fired on `window` when something outside this hook changed the follow graph. */
export const SOCIAL_CHANGED = "letterup:social-changed";

const EMPTY: SocialState = {
  me: {
    userId: "",
    username: "",
    avatarUrl: null,
    gamesPlayed: 0,
    wins: 0,
    roundsPlayed: 0,
    totalPoints: 0,
    bestScore: 0,
    averagePerRound: 0,
    online: true,
    isMe: true,
    isFollowing: false,
    isFollowedBy: false,
    currentRoomCode: null,
    winRate: 0,
    averagePerGame: 0,
    followers: 0,
    following: 0,
    lastSeenAt: 0,
    isBanned: false,
    banReason: null,
  },
  friends: [],
  invites: [],
};

/**
 * Follow graph, friend list and room invites. Polled slowly — it only changes
 * when someone follows or invites, so it doesn't need the game's realtime channel.
 */
export function useSocial(token: string | null, gameId: string | null) {
  const [social, setSocial] = useState<SocialState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  const call = useCallback(
    async (action: string, body: Record<string, unknown> = {}, opts: { silent?: boolean } = {}) => {
      try {
        const next = await postJson<SocialState>(`/api/social/${action}`, { gameId, ...body }, token ?? undefined);
        setSocial(next);
        loaded.current = true;
        if (!opts.silent) setError(null);
        return next;
      } catch (err) {
        if (!opts.silent) setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [gameId, token],
  );

  const refresh = useCallback(() => call("state", {}, { silent: true }), [call]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    const onChanged = () => void refresh();
    window.addEventListener(SOCIAL_CHANGED, onChanged);
    return () => {
      clearInterval(id);
      window.removeEventListener(SOCIAL_CHANGED, onChanged);
    };
  }, [refresh]);

  const withBusy = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return {
    social,
    error,
    busy,
    clearError: () => setError(null),
    refresh,
    follow: (userId: string, follow: boolean) => withBusy(() => call("follow", { userId, follow })),
    invite: (userId: string) => withBusy(() => call("invite", { userId })),
    dismissInvite: (inviteId: string) => withBusy(() => call("dismissInvite", { inviteId })),
    /** Profiles are fetched on demand — they're only shown in the modal. */
    loadProfile: (userId: string) => postJson<ProfileView>("/api/social/profile", { userId }, token ?? undefined),
  };
}

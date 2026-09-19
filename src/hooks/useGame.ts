"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, postJson } from "@/lib/api";
import { browserSupabase } from "@/lib/supabase-browser";
import type { GameState } from "@/lib/types";

const POLL_MS = 5_000; // heartbeat + fallback if the Realtime socket drops
const REALTIME_DEBOUNCE_MS = 120;
const OFFSET_SAMPLE_TTL_MS = 60_000;

export type CallGame = (
  action: string,
  body?: Record<string, unknown>,
  opts?: {
    silent?: boolean;
    /**
     * Paint the expected result straight away instead of waiting out the round
     * trip. The server's reply still overwrites it, so this only has to be close
     * enough to keep the button from feeling stuck; if the call fails, the next
     * poll puts the real state back.
     */
    optimistic?: (current: GameState) => GameState;
  },
) => Promise<GameState | null>;

/** `token` is the Discord Activity session token; browser players authenticate with a cookie instead. */
export function useGame(token: string | null, initial: GameState) {
  const gameId = initial.game.id;
  const [state, setState] = useState(initial);
  const [offset, setOffset] = useState(() => initial.serverNow - Date.now());
  const [error, setError] = useState<string | null>(null);
  // The room is gone for us (kicked, or deleted by cleanup). Polling would only
  // repeat the same 403/404 every five seconds over a frozen screen.
  const [gone, setGone] = useState(false);

  const seq = useRef(0);
  const applied = useRef(0);
  // Id of the newest call that painted an optimistic state.
  const optimisticFrom = useRef(0);
  const bestSample = useRef({ rtt: Number.POSITIVE_INFINITY, at: 0 });
  const version = useRef(initial.game.version);

  const call = useCallback<CallGame>(
    async (action, body = {}, opts = {}) => {
      const id = ++seq.current;
      const sentAt = Date.now();
      // Show the expected result before the request goes out. Every action costs a
      // full round trip to the API and several queries behind it, which through the
      // Discord proxy is long enough for a tap to feel ignored.
      if (opts.optimistic) {
        optimisticFrom.current = id;
        setState((current) => opts.optimistic!(current));
      }
      try {
        const next = await postJson<GameState>(`/api/game/${action}`, { ...body, gameId }, token ?? undefined);
        const receivedAt = Date.now();
        const rtt = receivedAt - sentAt;
        // Clock sync: keep the lowest-latency sample, refreshed at least once a minute.
        if (rtt <= bestSample.current.rtt || receivedAt - bestSample.current.at > OFFSET_SAMPLE_TTL_MS) {
          bestSample.current = { rtt, at: receivedAt };
          setOffset(next.serverNow - (sentAt + rtt / 2));
        }
        // Ignore responses to requests that were overtaken by newer ones -- including
        // one sent before a later optimistic change, which would briefly undo it
        // (quick settings taps flickered back to the old value).
        if (id > applied.current && id >= optimisticFrom.current) {
          applied.current = id;
          version.current = next.game.version;
          setState(next);
        }
        if (!opts.silent) setError(null);
        return next;
      } catch (err) {
        if (action === "state" && err instanceof ApiError && (err.status === 403 || err.status === 404)) setGone(true);
        if (!opts.silent) setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [gameId, token],
  );

  const inFlight = useRef(false);
  const again = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        await call("state", {}, { silent: true });
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, [call]);

  // Realtime: the games row's version bumps on every meaningful change.
  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const nextVersion = Number((payload.new as { version?: number }).version ?? 0);
          if (nextVersion <= version.current) return;
          clearTimeout(timer);
          timer = setTimeout(() => void refresh(), REALTIME_DEBOUNCE_MS);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [gameId, refresh]);

  // Heartbeat / fallback polling, plus an immediate refresh when the tab becomes visible again.
  useEffect(() => {
    if (gone) return;
    const interval = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, gone]);

  return { state, offset, error, gone, clearError: () => setError(null), call, refresh };
}

/** Server-synchronised clock that re-renders every `intervalMs`. */
export function useServerNow(offset: number, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(id);
  }, [offset, intervalMs]);
  return now;
}

/**
 * Fetch state just after a server deadline passes. The server only moves a round on
 * when someone asks (heartbeat or action), so without this the room would wait for
 * the next poll -- up to five seconds late, and at slightly different moments for
 * everyone.
 */
export function useRefreshAt(at: number | null, offset: number, refresh: () => Promise<void>): void {
  useEffect(() => {
    if (at === null) return;
    const wait = Math.max(0, at - (Date.now() + offset)) + 400;
    const id = setTimeout(() => void refresh(), wait);
    return () => clearTimeout(id);
  }, [at, offset, refresh]);
}

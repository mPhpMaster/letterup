"use client";

import { createContext, useContext } from "react";
import type { CallGame } from "@/hooks/useGame";
import type { GameState, PlayerView } from "@/lib/types";

export interface GameContextValue {
  state: GameState;
  me: PlayerView | undefined;
  isHost: boolean;
  hostName: string;
  /** Server clock offset in ms (serverTime ≈ Date.now() + offset). */
  offset: number;
  /** Discord user ids currently connected to this Activity instance (empty outside Discord). */
  participantIds: ReadonlySet<string>;
  call: CallGame;
  refresh: () => Promise<void>;
  /** Opens the stats card for a player (by Discord/user id). */
  openProfile: (userId: string) => void;
  openFriends: () => void;
  /** Copies the room invite link; null when the room can't be shared (Discord Activity). */
  copyInvite: (() => void) | null;
  /** Opens Discord's own invite dialog; null outside the Activity. */
  openDiscordInvite: (() => void) | null;
  /** Leaves the room and returns to the start page. */
  leaveRoom: () => void;
  /** Opens a URL outside the game -- through Discord's own prompt inside the Activity. */
  openLink: (url: string) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used inside <GameContext.Provider>");
  return ctx;
}

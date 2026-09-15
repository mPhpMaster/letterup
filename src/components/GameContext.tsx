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
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used inside <GameContext.Provider>");
  return ctx;
}

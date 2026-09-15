"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DiscordSDK } from "@discord/embedded-app-sdk";
import { useI18n } from "@/i18n/I18nProvider";
import { postJson } from "@/lib/api";
import { bootDiscord, isEmbeddedInDiscord, type BootStep } from "@/lib/discord";
import type { GameState } from "@/lib/types";
import { useGame } from "@/hooks/useGame";
import { GameContext, type GameContextValue } from "./GameContext";
import { GuestForm } from "./GuestForm";
import { Lobby } from "./Lobby";
import { RoundPlay } from "./RoundPlay";
import { Voting } from "./Voting";
import { RoundResults } from "./RoundResults";
import { FinalLeaderboard } from "./FinalLeaderboard";
import { ConfirmButton, LanguageToggle, Spinner } from "./ui";

type Boot =
  | { phase: "booting"; step: BootStep }
  | { phase: "guest" }
  | { phase: "error"; message: string }
  | { phase: "ready"; token: string; state: GameState; sdk?: DiscordSDK };

export default function App() {
  const { t, setLocale, hasStoredLocale } = useI18n();
  const [boot, setBoot] = useState<Boot>({ phase: "booting", step: "connecting" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev; the SDK handshake must run once
    started.current = true;
    if (!isEmbeddedInDiscord()) {
      setBoot({ phase: "guest" });
      return;
    }
    (async () => {
      try {
        const discord = await bootDiscord((step) => setBoot({ phase: "booting", step }));
        if (!hasStoredLocale() && discord.locale?.toLowerCase().startsWith("ar")) setLocale("ar");
        setBoot({ phase: "booting", step: "joining" });
        const state = await postJson<GameState>("/api/game/join", { instanceId: discord.instanceId }, discord.token);
        setBoot({ phase: "ready", token: discord.token, state, sdk: discord.sdk });
      } catch (err) {
        console.error(err);
        setBoot({ phase: "error", message: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [hasStoredLocale, setLocale]);

  if (boot.phase === "ready") return <GameScreen token={boot.token} initial={boot.state} sdk={boot.sdk} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("app.title")}</h1>
        {boot.phase === "booting" && (
          <>
            <Spinner />
            <p className="text-muted">{t(`boot.${boot.step}`)}</p>
          </>
        )}
        {boot.phase === "error" && (
          <div className="card w-full text-start">
            <p className="font-bold text-bad">{t("boot.failed")}</p>
            <p className="mt-1 break-words text-sm text-muted" dir="ltr">
              {boot.message}
            </p>
            <p className="mt-3 text-sm text-muted">{t("boot.hint")}</p>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => window.location.reload()}>
              {t("common.retry")}
            </button>
          </div>
        )}
        {boot.phase === "guest" && (
          <GuestForm onJoined={(token, state) => setBoot({ phase: "ready", token, state })} />
        )}
      </div>
    </main>
  );
}

function useDiscordParticipants(sdk: DiscordSDK | undefined, onChange: () => void): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!sdk) return;
    let active = true;
    const handle = (event: { participants: { id: string }[] }) => {
      if (!active) return;
      setIds(new Set(event.participants.map((p) => p.id)));
      onChange();
    };
    sdk.commands.getInstanceConnectedParticipants().then(handle).catch(console.warn);
    sdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", handle).catch(console.warn);
    return () => {
      active = false;
      sdk.unsubscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", handle).catch(() => {});
    };
  }, [sdk, onChange]);
  return ids;
}

function GameScreen({ token, initial, sdk }: { token: string; initial: GameState; sdk?: DiscordSDK }) {
  const { t } = useI18n();
  const { state, offset, error, clearError, call, refresh } = useGame(token, initial);
  const participantIds = useDiscordParticipants(sdk, refresh);

  const ctx = useMemo<GameContextValue>(() => {
    const host = state.players.find((p) => p.isHost);
    return {
      state,
      me: state.players.find((p) => p.id === state.me.playerId),
      isHost: state.game.hostUserId === state.me.userId,
      hostName: host?.username ?? t("common.host"),
      offset,
      participantIds,
      call,
      refresh,
    };
  }, [state, offset, participantIds, call, refresh, t]);

  const { status } = state.game;
  const inGame = status === "playing" || status === "voting" || status === "results";

  return (
    <GameContext.Provider value={ctx}>
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-3 pb-6 sm:px-5">
        <header className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="letter-tile text-lg" style={{ width: 34 }}>
              {state.settings.letterLocale === "ar" ? "ح" : "A"}
            </span>
            <h1 className="truncate text-base font-extrabold sm:text-lg">{t("app.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            {inGame && (
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold tabular-nums text-muted">
                {t("header.round", { current: state.game.currentRound, total: state.settings.totalRounds })}
              </span>
            )}
            {inGame && ctx.isHost && <ConfirmButton onConfirm={() => void call("lobby")}>{t("header.endGame")}</ConfirmButton>}
            <LanguageToggle />
          </div>
        </header>

        <main className="flex-1">
          {status === "lobby" && <Lobby />}
          {status === "playing" && state.round && <RoundPlay key={state.round.id} />}
          {status === "voting" && state.round && <Voting />}
          {status === "results" && state.round && <RoundResults />}
          {status === "finished" && <FinalLeaderboard />}
        </main>

        {error && (
          <div role="alert" className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-bad/50 bg-surface px-4 py-3 shadow-2xl">
            <span className="flex-1 text-sm" dir="auto">
              {error}
            </span>
            <button type="button" className="btn btn-sm" onClick={clearError}>
              {t("common.dismiss")}
            </button>
          </div>
        )}
      </div>
    </GameContext.Provider>
  );
}

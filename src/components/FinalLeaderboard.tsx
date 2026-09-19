"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { rankByScore } from "@/lib/ranking";
import { useSound } from "@/lib/sound";
import { AnswersBoard } from "./AnswersBoard";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, ConfirmButton, Confetti, PlayerName } from "./ui";

/** Podium blocks, in visual order 2nd · 1st · 3rd (flex follows direction, so RTL mirrors it). */
const PODIUM = [
  { place: 1, height: "h-20", bg: "bg-sky" },
  { place: 0, height: "h-32", bg: "bg-accent" },
  { place: 2, height: "h-14", bg: "bg-grape" },
] as const;

export function FinalLeaderboard() {
  const { state, isHost, hostName, call, openProfile, leaveRoom } = useGameContext();
  const { t } = useI18n();
  const { play } = useSound();
  const ranked = rankByScore(state.players);
  const topScore = ranked[0]?.score ?? 0;
  // Nobody scoring is not a win -- no crown, no trophy, no confetti.
  const someoneScored = topScore > 0;
  const winners = someoneScored ? ranked.filter((p) => p.rank === 1) : [];
  // Ended early by the host, the last round may never have been scored: don't show
  // its unjudged answers or count it.
  const round = state.round?.status === "scored" ? state.round : null;
  const roundsPlayed = state.round?.status === "scored" ? state.game.currentRound : Math.max(0, state.game.currentRound - 1);

  useEffect(() => {
    play(someoneScored ? "fanfare" : "click");
  }, [play, someoneScored]);

  const headline = !someoneScored
    ? t("final.noScore")
    : winners.length === 1
      ? t("final.winner", { name: winners[0].username })
      : t("final.tie", { names: winners.map((w) => w.username).join(t("final.listSeparator")) });

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-col gap-5">
      {someoneScored && <Confetti />}
      <section className="card-pop animate-rise relative overflow-hidden text-center">
        <p className="kicker">{roundsPlayed === 0
            ? t("final.endedBeforeAnyRound")
            : roundsPlayed < state.settings.totalRounds
              ? t("final.endedEarly", { count: roundsPlayed })
              : t("final.kicker", { count: roundsPlayed })}</p>
        <h2 className="headline mt-1 text-3xl text-brand">{t("final.title")} 🎊</h2>
        <p className="headline mt-2 text-lg text-ink" dir="auto">
          {headline}
        </p>

        {/* Podium: only when there's someone to put on it, and more than one player to compare. */}
        {someoneScored && ranked.length > 1 && (
          <div className="mt-8 grid grid-cols-3 items-end gap-2">
            {PODIUM.map(({ place, height, bg }) => {
              const p = ranked[place];
              if (!p) return <div key={place} />;
              return (
                <div key={place} className="flex min-w-0 flex-col items-center gap-2">
                  <span className="animate-score-pop relative" style={{ animationDelay: `${(place + 1) * 120}ms` }}>
                    {p.rank === 1 && <span className="absolute -top-5 start-1/2 -translate-x-1/2 text-2xl rtl:translate-x-1/2">👑</span>}
                    <Avatar name={p.username} url={p.avatarUrl} size={p.rank === 1 ? 60 : 48} ring={p.rank === 1 ? "3px solid var(--color-accent)" : undefined} />
                  </span>
                  <button type="button" className="max-w-full truncate text-xs font-extrabold hover:underline" onClick={() => openProfile(p.userId)}>
                    {p.username}
                  </button>
                  <div className={`${height} ${bg} headline grid w-full place-items-center rounded-t-3xl text-3xl text-ink shadow-[0_6px_0_rgba(0,0,0,0.12)]`}>
                    {p.rank === 1 ? "🏆" : p.rank}
                  </div>
                  <span className="headline text-lg tabular-nums">{t("final.points", { count: p.score })}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Everyone, always: the podium alone hid 4th place and below, and a solo or
            scoreless game had nothing but an empty block. */}
        <p className="kicker mt-7 text-start">{t("final.standings")}</p>
        <ul className="mt-2 flex flex-col gap-2 text-start">
          {ranked.map((p, i) => {
            const winner = someoneScored && p.rank === 1;
            return (
              <li
                key={p.id}
                className={`animate-rise grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-2.5 ${winner ? "bg-accent/25" : "bg-cream"}`}
                style={{ animationDelay: `${200 + i * 60}ms` }}
              >
                <span className="headline grid size-8 place-items-center rounded-xl bg-paper text-sm">{winner ? "👑" : p.rank}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={p.username} url={p.avatarUrl} size={34} />
                  <span className="flex min-w-0 text-sm">
                    <PlayerName player={p} meId={state.me.playerId} showCrown={false} onClick={() => openProfile(p.userId)} />
                  </span>
                </div>
                <span className="headline text-lg tabular-nums">{t("final.points", { count: p.score })}</span>
              </li>
            );
          })}
        </ul>

        {round && (
          <details className="group mt-5 text-start">
            <summary className="btn btn-ghost w-full cursor-pointer list-none">
              {t("final.lastRoundAnswers", { letter: round.letter })}
              <Icon name="arrowRight" size={16} className="transition-transform group-open:rotate-90 rtl:-scale-x-100 rtl:group-open:-rotate-90" />
            </summary>
            <div className="mt-4">
              <AnswersBoard mode="final" />
            </div>
          </details>
        )}

        <div className="mt-7 flex flex-col gap-3">
          {isHost ? (
            <button
              type="button"
              className="btn btn-brand w-full py-4 text-xl"
              onClick={() => {
                play("click");
                void call("lobby");
              }}
            >
              <Icon name="replay" size={20} />
              {t("final.playAgain")}
            </button>
          ) : (
            <div className="waiting">
              <p className="animate-pulse-soft">{t("final.waitingHost", { name: hostName })}</p>
            </div>
          )}
          <ConfirmButton className="btn btn-ghost btn-sm self-center" onConfirm={leaveRoom}>
            <Icon name="signOut" size={15} className="rtl:-scale-x-100" />
            {t("final.leave")}
          </ConfirmButton>
        </div>
      </section>
    </div>
  );
}

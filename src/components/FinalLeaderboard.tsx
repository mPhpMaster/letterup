"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { rankByScore } from "@/lib/ranking";
import { useSound } from "@/lib/sound";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, Confetti, PlayerName } from "./ui";

/** Podium blocks, in visual order 2nd · 1st · 3rd (flex follows direction, so RTL mirrors it). */
const PODIUM = [
  { place: 1, height: "h-20", bg: "bg-sky" },
  { place: 0, height: "h-32", bg: "bg-accent" },
  { place: 2, height: "h-14", bg: "bg-grape" },
] as const;

export function FinalLeaderboard() {
  const { state, isHost, hostName, call, openProfile } = useGameContext();
  const { t } = useI18n();
  const { play } = useSound();
  const ranked = rankByScore(state.players);
  const winners = ranked.filter((p) => p.rank === 1);
  const rest = ranked.slice(3);

  useEffect(() => {
    play("fanfare");
  }, [play]);

  const headline =
    winners.length === 1
      ? t("final.winner", { name: winners[0].username })
      : t("final.tie", { names: winners.map((w) => w.username).join(t("final.listSeparator")) });

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-col gap-5">
      <Confetti />
      <section className="card-pop animate-rise relative overflow-hidden text-center">
        <p className="headline text-3xl text-brand">{t("final.title")} 🎊</p>
        <p className="kicker mt-1" dir="auto">
          {headline}
        </p>

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
                <div className={`${height} ${bg} headline grid w-full place-items-center rounded-t-3xl text-2xl text-ink shadow-[0_6px_0_rgba(0,0,0,0.12)]`}>
                  {p.rank === 1 ? "🏆" : p.rank}
                </div>
                <span className="headline text-lg tabular-nums">{p.score}</span>
              </div>
            );
          })}
        </div>

        {rest.length > 0 && (
          <>
            <p className="kicker mt-7">{t("final.standings")}</p>
            <ul className="mt-2 flex flex-col gap-2 text-start">
              {rest.map((p) => (
                <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-cream p-2.5">
                  <span className="headline grid size-7 place-items-center rounded-xl bg-paper text-sm">{p.rank}</span>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={p.username} url={p.avatarUrl} size={32} />
                    <span className="flex min-w-0 text-sm">
                      <PlayerName player={p} meId={state.me.playerId} onClick={() => openProfile(p.userId)} />
                    </span>
                  </div>
                  <span className="headline text-base tabular-nums">{p.score}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-7">
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
        </div>
      </section>
    </div>
  );
}

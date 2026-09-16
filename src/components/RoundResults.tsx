"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { rankByScore } from "@/lib/ranking";
import { useSound } from "@/lib/sound";
import { AnswersBoard } from "./AnswersBoard";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, LetterTile, PlayerName } from "./ui";

export function RoundResults() {
  const { state, isHost, hostName, call, openProfile } = useGameContext();
  const { t } = useI18n();
  const { play } = useSound();
  const round = state.round!;
  const isLast = round.number >= state.settings.totalRounds;

  useEffect(() => {
    play("score");
  }, [play, round.id]);

  const roundPoints = (playerId: string) => round.answers.filter((a) => a.playerId === playerId).reduce((sum, a) => sum + a.points, 0);
  const ranked = rankByScore(state.players);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <section className="card-pop animate-rise">
        <div className="flex items-center justify-center gap-3">
          <LetterTile letter={round.letter} size={48} />
          <div className="min-w-0">
            <p className="kicker">{t("results.title", { number: round.number })}</p>
            <h2 className="headline text-2xl">{t("results.scoreboard")}</h2>
          </div>
        </div>

        <ul className="mt-5 flex flex-col gap-2">
          {ranked.map((p, i) => {
            const gained = roundPoints(p.id);
            return (
              <li
                key={p.id}
                className={`animate-rise grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3 ${p.rank === 1 ? "bg-accent/25" : "bg-cream"}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="headline grid size-8 shrink-0 place-items-center rounded-xl bg-paper text-sm">{p.rank === 1 ? "👑" : p.rank}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={p.username} url={p.avatarUrl} size={36} />
                  <span className="flex min-w-0 text-sm">
                    <PlayerName player={p} meId={state.me.playerId} onClick={() => openProfile(p.userId)} />
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {gained > 0 && (
                    <span
                      className="headline animate-score-pop rounded-full bg-mint/20 px-2 py-0.5 text-xs text-mint-deep"
                      style={{ animationDelay: `${300 + i * 70}ms` }}
                    >
                      +{gained}
                    </span>
                  )}
                  <span className="headline animate-score-pop text-xl tabular-nums" style={{ animationDelay: `${200 + i * 70}ms` }}>
                    {p.score}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <details className="group mt-5">
          <summary className="btn btn-ghost w-full cursor-pointer list-none">
            {t("results.showAnswers")}
            <Icon name="arrowRight" size={16} className="transition-transform group-open:rotate-90 rtl:-scale-x-100" />
          </summary>
          <div className="mt-4">
            <AnswersBoard mode="final" />
          </div>
        </details>
      </section>

      <div className="z-10 sm:sticky sm:bottom-3">
        {isHost ? (
          <button
            type="button"
            className="btn btn-brand w-full py-4 text-xl"
            onClick={() => {
              play("click");
              void call("next");
            }}
          >
            {isLast ? t("results.final") : t("results.next")}
            <Icon name="arrowRight" size={20} className="rtl:-scale-x-100" />
          </button>
        ) : (
          <div className="waiting">
            <p className="animate-pulse-soft">{t("results.waitingHost", { name: hostName })}</p>
          </div>
        )}
      </div>
    </div>
  );
}

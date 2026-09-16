"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { rankByScore } from "@/lib/ranking";
import { AnswersBoard } from "./AnswersBoard";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, LetterTile, PlayerName } from "./ui";

export function RoundResults() {
  const { state, isHost, hostName, call, openProfile } = useGameContext();
  const { t } = useI18n();
  const round = state.round!;
  const isLast = round.number >= state.settings.totalRounds;

  const roundPoints = (playerId: string) => round.answers.filter((a) => a.playerId === playerId).reduce((sum, a) => sum + a.points, 0);
  const ranked = rankByScore(state.players);

  return (
    <div className="animate-rise flex flex-col gap-4">
      <div className="flex items-center justify-center gap-3">
        <LetterTile letter={round.letter} size={52} />
        <h2 className="headline text-[24px]">{t("results.title", { number: round.number })}</h2>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 text-[11px] font-bold tracking-wide text-sand uppercase">
          <span className="w-5" />
          <span className="flex-1" />
          <span className="w-16 text-end">{t("results.thisRound")}</span>
          <span className="w-14 text-end">{t("results.total")}</span>
        </div>
        {ranked.map((p) => (
          <div key={p.id} className="animate-score-pop flex items-center gap-3 rounded-[16px] border-2 border-line bg-card p-3">
            <span className="headline w-5 text-[16px] text-sand">{p.rank}</span>
            <Avatar name={p.username} url={p.avatarUrl} size={38} />
            <span className="min-w-0 flex-1">
              <PlayerName player={p} meId={state.me.playerId} onClick={() => openProfile(p.userId)} />
            </span>
            <span className="w-16 text-end text-[11px] font-bold text-mint">+{roundPoints(p.id)}</span>
            <span className="headline w-14 text-end text-[18px] text-orange">{p.score}</span>
          </div>
        ))}
      </div>

      <details className="group">
        <summary className="btn btn-ghost w-full cursor-pointer list-none">
          {t("results.showAnswers")}
          <Icon name="arrowRight" size={16} className="transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-3">
          <AnswersBoard mode="final" />
        </div>
      </details>

      <div className="sticky bottom-3 z-10">
        {isHost ? (
          <button type="button" className="btn btn-primary w-full text-base" onClick={() => void call("next")}>
            <Icon name="arrowRight" size={18} />
            {isLast ? t("results.final") : t("results.next")}
          </button>
        ) : (
          <div className="waiting">
            <Icon name="hourglass" size={16} className="me-1.5 inline" />
            {t("results.waitingHost", { name: hostName })}
          </div>
        )}
      </div>
    </div>
  );
}

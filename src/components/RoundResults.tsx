"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { rankByScore } from "@/lib/ranking";
import { AnswersBoard } from "./AnswersBoard";
import { useGameContext } from "./GameContext";
import { Avatar, LetterTile, PlayerName } from "./ui";

export function RoundResults() {
  const { state, isHost, hostName, call } = useGameContext();
  const { t } = useI18n();
  const round = state.round!;
  const isLast = round.number >= state.settings.totalRounds;

  const roundPoints = (playerId: string) =>
    round.answers.filter((a) => a.playerId === playerId).reduce((sum, a) => sum + a.points, 0);
  const ranked = rankByScore(state.players);

  return (
    <div className="animate-rise space-y-4">
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <LetterTile letter={round.letter} size={48} />
          <h2 className="text-xl font-extrabold">{t("results.title", { number: round.number })}</h2>
        </div>

        <ol className="space-y-2">
          <li className="flex items-center gap-3 px-3 text-xs font-bold uppercase tracking-wide text-muted">
            <span className="w-6" />
            <span className="flex-1" />
            <span className="w-20 text-end">{t("results.thisRound")}</span>
            <span className="w-16 text-end">{t("results.total")}</span>
          </li>
          {ranked.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
              <span className="w-6 text-center font-extrabold tabular-nums text-muted">{p.rank}</span>
              <Avatar name={p.username} url={p.avatarUrl} size={32} />
              <span className="min-w-0 flex-1">
                <PlayerName player={p} meId={state.me.playerId} />
              </span>
              <span className="w-20 text-end font-bold tabular-nums text-good">+{roundPoints(p.id)}</span>
              <span className="w-16 text-end text-lg font-extrabold tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      </div>

      <details className="group">
        <summary className="btn w-full cursor-pointer list-none">
          {t("results.showAnswers")} <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-3">
          <AnswersBoard mode="final" />
        </div>
      </details>

      <div className="sticky bottom-3 z-10">
        {isHost ? (
          <button type="button" className="btn btn-sun w-full text-lg shadow-xl" onClick={() => void call("next")}>
            {isLast ? `🏆 ${t("results.final")}` : `${t("results.next")} →`}
          </button>
        ) : (
          <p className="rounded-xl border border-line bg-surface/95 px-4 py-3 text-center text-sm text-muted shadow-xl backdrop-blur">
            {t("results.waitingHost", { name: hostName })}
          </p>
        )}
      </div>
    </div>
  );
}

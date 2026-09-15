"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { AnswersBoard } from "./AnswersBoard";
import { useGameContext } from "./GameContext";
import { LetterTile } from "./ui";

export function Voting() {
  const { state, isHost, hostName, call } = useGameContext();
  const { t } = useI18n();
  const round = state.round!;

  return (
    <div className="animate-rise space-y-4">
      <div className="card flex items-start gap-4">
        <LetterTile letter={round.letter} size={60} />
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold">{t("vote.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("vote.help")}</p>
          <p className="mt-1 text-xs font-semibold text-muted">{t("vote.rules")}</p>
          {isHost && <p className="mt-1 text-xs font-semibold text-brand">{t("vote.hostHelp")}</p>}
        </div>
      </div>

      <AnswersBoard mode="vote" />

      <div className="sticky bottom-3 z-10">
        {isHost ? (
          <button type="button" className="btn btn-sun w-full text-lg shadow-xl" onClick={() => void call("tally")}>
            {t("vote.confirm")} →
          </button>
        ) : (
          <p className="rounded-xl border border-line bg-surface/95 px-4 py-3 text-center text-sm text-muted shadow-xl backdrop-blur">
            {t("vote.waitingHost", { name: hostName })}
          </p>
        )}
      </div>
    </div>
  );
}

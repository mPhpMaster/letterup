"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { AnswersBoard } from "./AnswersBoard";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { LetterTile } from "./ui";

export function Voting() {
  const { state, isHost, hostName, call } = useGameContext();
  const { t } = useI18n();
  const round = state.round!;
  const twoPlayers = state.players.length <= 2;

  return (
    <div className="animate-rise flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <LetterTile letter={round.letter} size={64} />
        <div className="min-w-0">
          <h2 className="headline text-[24px]">{t("vote.title")}</h2>
          <p className="mt-1 text-[12px] text-muted">{twoPlayers ? t("vote.helpTwoPlayers") : t("vote.help")}</p>
          <p className="mt-1 text-[11px] font-bold text-sand">{t("vote.rules")}</p>
          {isHost && <p className="mt-1 text-[11px] font-bold text-orange">{t("vote.hostHelp")}</p>}
        </div>
      </div>

      <AnswersBoard mode="vote" />

      <div className="sticky bottom-3 z-10">
        {isHost ? (
          <button type="button" className="btn btn-primary w-full text-base" onClick={() => void call("tally")}>
            <Icon name="sealCheck" size={18} />
            {t("vote.confirm")}
          </button>
        ) : (
          <div className="waiting">
            <Icon name="hourglass" size={16} className="me-1.5 inline" />
            {t("vote.waitingHost", { name: hostName })}
          </div>
        )}
      </div>
    </div>
  );
}

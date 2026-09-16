"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { useServerNow } from "@/hooks/useGame";
import { AnswersBoard } from "./AnswersBoard";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { LetterTile, TimerRing } from "./ui";

/** Matches the window the server stamps on the round: per player, per category. */
const SECONDS_PER_PLAYER_PER_CATEGORY = 5;

export function Voting() {
  const { state, isHost, hostName, offset, call } = useGameContext();
  const { t } = useI18n();
  const round = state.round!;
  const twoPlayers = state.players.length <= 2;

  // Read the shared clock, not this device's -- the deadline lives on the server.
  const now = useServerNow(offset);

  // The room reviews one category at a time. The server pushes the index on once
  // everyone still present has voted on that category, so it runs one past the
  // last one when the whole round has been settled.
  const total = round.categories.length;
  const reviewing = round.voteCategoryIndex < total;
  const current = Math.min(round.voteCategoryIndex + 1, total);

  return (
    <div className="animate-rise flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <LetterTile letter={round.letter} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="headline text-[24px]">{t("vote.title")}</h2>
          <p className="mt-1 text-[11px] font-bold text-orange">
            {reviewing ? t("vote.progress", { current, total }) : t("vote.allReviewed")}
          </p>
          <p className="mt-1 text-[12px] text-muted">{twoPlayers ? t("vote.helpTwoPlayers") : t("vote.help")}</p>
          <p className="mt-1 text-[11px] font-bold text-sand">{t("vote.rules")}</p>
          {isHost && <p className="mt-1 text-[11px] font-bold text-orange">{t("vote.hostHelp")}</p>}
        </div>
        {round.voteEndsAt !== null && (
          <TimerRing
            remainingMs={round.voteEndsAt - now}
            totalMs={Math.max(1, state.players.length * total * SECONDS_PER_PLAYER_PER_CATEGORY * 1000)}
          />
        )}
      </div>

      <AnswersBoard mode="vote" />

      <div className="z-10 flex flex-col gap-2 sm:sticky sm:bottom-3">
        {round.voteEndsAt !== null && <p className="text-center text-[11px] text-muted">{t("vote.autoConfirm")}</p>}
        {reviewing ? (
          <div className="waiting">
            <Icon name="hourglass" size={16} className="me-1.5 inline" />
            {t("vote.waitingOthers")}
          </div>
        ) : isHost ? (
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

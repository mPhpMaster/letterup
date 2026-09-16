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
  // Exactly two: a solo round has nobody to outvote, so the two-player rule would mislead.
  const twoPlayers = state.players.length === 2;

  // Read the shared clock, not this device's -- the deadline lives on the server.
  const now = useServerNow(offset);

  // The room reviews one category at a time. The server pushes the index on once
  // everyone still present has voted on that category, so it runs one past the
  // last one when the whole round has been settled.
  const total = round.categories.length;
  const reviewing = round.voteCategoryIndex < total;
  const current = Math.min(round.voteCategoryIndex + 1, total);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <section className="card-ink animate-rise">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold tracking-widest text-accent uppercase rtl:tracking-normal">
              <span className="md:hidden">{t("header.roundLong", { current: round.number, total: state.settings.totalRounds })} · </span>
              {reviewing ? t("vote.progress", { current, total }) : t("vote.allReviewed")}
            </p>
            <h2 className="headline mt-0.5 text-2xl">{t("vote.title")}</h2>
            <p className="mt-1 text-sm font-semibold text-cream/70">{twoPlayers ? t("vote.helpTwoPlayers") : t("vote.help")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row">
            {round.voteEndsAt !== null && (
              <TimerRing
                remainingMs={round.voteEndsAt - now}
                totalMs={Math.max(1, state.players.length * total * SECONDS_PER_PLAYER_PER_CATEGORY * 1000)}
                size={56}
              />
            )}
            <LetterTile letter={round.letter} size={60} />
          </div>
        </div>

        {/* Category progress: one dot per category, filled once the room has moved past it. */}
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {round.categories.map((c, i) => (
            <span
              key={c}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < round.voteCategoryIndex ? "bg-mint" : i === round.voteCategoryIndex ? "bg-accent" : "bg-cream/15"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-extrabold">
          <span className="rounded-full bg-mint/20 px-2.5 py-1 text-mint">{t("vote.legendUnique")}</span>
          <span className="rounded-full bg-accent/20 px-2.5 py-1 text-accent">{t("vote.legendShared")}</span>
          <span className="rounded-full bg-brand/25 px-2.5 py-1 text-cream">{t("vote.legendInvalid")}</span>
        </div>
        {isHost && <p className="mt-3 text-xs font-bold text-accent">{t("vote.hostHelp")}</p>}
      </section>

      <AnswersBoard mode="vote" />

      {/* Kept out of the sticky bar below: text in it floated over the answers as they
          scrolled underneath. */}
      {round.voteEndsAt !== null && <p className="text-center text-xs font-bold text-muted">{t("vote.autoConfirm")}</p>}

      <div className="z-10 sm:sticky sm:bottom-3">
        {reviewing ? (
          <div className="waiting">
            <p className="animate-pulse-soft">{t("vote.waitingOthers")}</p>
          </div>
        ) : isHost ? (
          <button type="button" className="btn btn-ink w-full py-4 text-xl" onClick={() => void call("tally")}>
            <Icon name="sealCheck" size={22} />
            {t("vote.confirm")}
          </button>
        ) : (
          <div className="waiting">
            <p className="animate-pulse-soft">{t("vote.waitingHost", { name: hostName })}</p>
          </div>
        )}
      </div>
    </div>
  );
}

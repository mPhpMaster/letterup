"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { computeRoundScores, type AnswerScore } from "@/lib/scoring";
import { useSound } from "@/lib/sound";
import type { AnswerView, PlayerView } from "@/lib/types";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, CategoryTile } from "./ui";

type Status = "unique" | "duplicate" | "rejected" | "empty";

/** Left border and tint per answer status: green unique, yellow shared, red thrown out. */
const ROW_STYLE: Record<Status, string> = {
  unique: "border-mint bg-mint/10",
  duplicate: "border-accent bg-accent/15",
  rejected: "border-brand bg-brand/10",
  empty: "border-ink/15 bg-cream",
};

const BADGE_STYLE: Record<Status, string> = {
  unique: "bg-mint text-ink",
  duplicate: "bg-accent text-ink",
  rejected: "bg-brand text-white",
  empty: "bg-ink/10 text-ink/50",
};

/**
 * Answers grouped by category.
 *  - "vote":  live preview of validity/points, with 👍/👎 and the host's ✓/✗
 *  - "final": the scores as stored on the server
 */
export function AnswersBoard({ mode }: { mode: "vote" | "final" }) {
  const { state } = useGameContext();
  const { t } = useI18n();
  const round = state.round!;

  const preview = useMemo(
    () =>
      new Map(
        computeRoundScores(
          round.answers.map((a) => ({
            id: a.id,
            playerId: a.playerId,
            category: a.category,
            normalized: a.normalized,
            autoValid: a.autoValid,
            hostVerdict: a.hostVerdict,
          })),
          round.votes,
          state.players.length,
        ).map((s) => [s.id, s]),
      ),
    [round.answers, round.votes, state.players.length],
  );

  const participants = state.players.filter(
    (p) => round.answers.some((a) => a.playerId === p.id) || round.submittedPlayerIds.includes(p.id),
  );

  // Voting walks the categories one at a time so the whole room is looking at the
  // same list; the final board still shows the round in full.
  // Once the index runs past the last category every vote is in, so the board opens
  // back up in full for the host to look over before confirming the scores.
  const reviewing = mode === "vote" && round.voteCategoryIndex < round.categories.length;
  const shown = reviewing ? round.categories.slice(round.voteCategoryIndex, round.voteCategoryIndex + 1) : round.categories;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {shown.map((category, i) => (
        <section key={category} className="card-pop-sm animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
          <h3 className="flex items-center gap-2.5">
            <CategoryTile id={category} size={38} />
            <span className="headline text-lg">{t(`categories.${category}`)}</span>
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {participants.map((player) => {
              const answer = round.answers.find((a) => a.playerId === player.id && a.category === category);
              return (
                <AnswerRow key={player.id} mode={mode} player={player} answer={answer} score={answer ? preview.get(answer.id) : undefined} />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AnswerRow({
  mode,
  player,
  answer,
  score,
}: {
  mode: "vote" | "final";
  player: PlayerView;
  answer: AnswerView | undefined;
  score: AnswerScore | undefined;
}) {
  const { state, isHost, call, openProfile, openLink } = useGameContext();
  const { t } = useI18n();
  const { play } = useSound();
  const mine = player.id === state.me.playerId;
  const hasValue = !!answer?.normalized;
  const valid = mode === "final" ? answer?.isValid === true : score?.isValid === true;
  const points = mode === "final" ? (answer?.points ?? 0) : (score?.points ?? 0);
  const duplicate = score?.duplicate === true;

  // Voting is the most-tapped part of the game, so both the button state and the
  // running score move before the request comes back. round.votes carries no voter
  // id -- buildState drops it -- but only the tallies matter, so swapping one entry
  // for another keeps the preview honest.
  const castVote = (next: boolean | null) => {
    if (next !== null) play(next ? "vote-up" : "vote-down");
    void call(
      "vote",
      { answerId: answer!.id, approve: next },
      {
        optimistic: (s) => {
          if (!s.round) return s;
          const was = answer!.myVote;
          const votes = s.round.votes.filter((v, i, all) => {
            if (was === null) return true;
            return !(v.answerId === answer!.id && v.approve === was && all.findIndex((x) => x.answerId === v.answerId && x.approve === v.approve) === i);
          });
          if (next !== null) votes.push({ answerId: answer!.id, approve: next });
          return {
            ...s,
            round: {
              ...s.round,
              votes,
              answers: s.round.answers.map((a) =>
                a.id === answer!.id
                  ? {
                      ...a,
                      myVote: next,
                      approvals: a.approvals + (next === true ? 1 : 0) - (was === true ? 1 : 0),
                      rejections: a.rejections + (next === false ? 1 : 0) - (was === false ? 1 : 0),
                    }
                  : a,
              ),
            },
          };
        },
      },
    );
  };

  const castVerdict = (next: boolean | null) => {
    play("select");
    void call(
      "verdict",
      { answerId: answer!.id, verdict: next },
      {
        optimistic: (s) =>
          s.round
            ? { ...s, round: { ...s.round, answers: s.round.answers.map((a) => (a.id === answer!.id ? { ...a, hostVerdict: next } : a)) } }
            : s,
      },
    );
  };

  const status: Status = !hasValue ? "empty" : !valid ? "rejected" : duplicate ? "duplicate" : "unique";
  const statusLabel = !hasValue
    ? t("vote.noAnswer")
    : !valid
      ? answer && !answer.autoValid
        ? t(mode === "vote" ? "vote.wrongLetterVote" : "vote.wrongLetter")
        : t("vote.rejected")
      : duplicate
        ? t("vote.duplicate")
        : t("vote.unique");

  return (
    <li className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-2xl border-s-4 p-2.5 sm:flex-nowrap ${ROW_STYLE[status]}`}>
      <div className="flex min-w-0 flex-1 basis-[55%] items-center gap-2.5">
        <button type="button" className="shrink-0" onClick={() => openProfile(player.userId)} aria-label={player.username}>
          <Avatar name={player.username} url={player.avatarUrl} size={34} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold" dir="auto">
            {hasValue ? answer!.value : <span className="text-ink/35">{t("vote.noAnswer")}</span>}
          </p>
          <p className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-ink/45">
            <button type="button" className="truncate hover:underline" onClick={() => openProfile(player.userId)}>
              {mine ? `${player.username} (${t("common.you")})` : player.username}
            </button>
            {answer?.hostVerdict != null && <span className="shrink-0 text-grape">· {t("vote.hostRuled")}</span>}
            {/* The badge is hidden on narrow panels (Discord's included); keep the verdict readable there. */}
            {hasValue && status === "rejected" && <span className="truncate text-brand sm:hidden">· {statusLabel}</span>}
          </p>
        </div>
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-1.5">
        {/* Settle "is that even a thing?" without leaving the game: image results for the word. */}
        {hasValue && (
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-xl bg-paper text-ink/45 transition-colors hover:text-brand"
            aria-label={t("vote.lookUp", { word: answer!.value })}
            title={t("vote.lookUp", { word: answer!.value })}
            onClick={() => openLink(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(answer!.value)}`)}
          >
            <Icon name="search" size={15} />
          </button>
        )}
        <span className={`hidden rounded-full px-2 py-1 text-[10px] font-extrabold uppercase sm:block ${BADGE_STYLE[status]}`}>{statusLabel}</span>
        <span className="headline min-w-10 text-end text-sm text-ink/70 tabular-nums">+{points}</span>

        {mode === "vote" && answer && hasValue && !mine && (
          <span className="flex items-center gap-1" role="group" aria-label={t("vote.votes")}>
            <VoteButton
              pressed={answer.myVote === true}
              label={t("vote.approve")}
              emoji="👍"
              count={answer.approvals}
              pressedClass="bg-mint"
              onClick={() => castVote(answer.myVote === true ? null : true)}
            />
            <VoteButton
              pressed={answer.myVote === false}
              label={t("vote.reject")}
              emoji="👎"
              count={answer.rejections}
              pressedClass="bg-brand"
              onClick={() => castVote(answer.myVote === false ? null : false)}
            />
            {isHost && (
              <span className="ms-1 flex items-center gap-1 border-s-2 border-ink/10 ps-1.5">
                <VerdictButton
                  pressed={answer.hostVerdict === true}
                  label={t("vote.forceValid")}
                  icon="check"
                  pressedClass="bg-mint text-ink"
                  onClick={() => castVerdict(answer.hostVerdict === true ? null : true)}
                />
                <VerdictButton
                  pressed={answer.hostVerdict === false}
                  label={t("vote.forceInvalid")}
                  icon="close"
                  pressedClass="bg-brand text-white"
                  onClick={() => castVerdict(answer.hostVerdict === false ? null : false)}
                />
              </span>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

function VoteButton({
  pressed,
  label,
  emoji,
  count,
  pressedClass,
  onClick,
}: {
  pressed: boolean;
  label: string;
  emoji: string;
  count: number;
  pressedClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-xl px-1.5 text-sm transition-transform active:scale-90 ${pressed ? pressedClass : "bg-ink/5"}`}
    >
      <span aria-hidden>{emoji}</span>
      {count > 0 && <span className="text-[11px] font-extrabold tabular-nums">{count}</span>}
    </button>
  );
}

function VerdictButton({
  pressed,
  label,
  icon,
  pressedClass,
  onClick,
}: {
  pressed: boolean;
  label: string;
  icon: "check" | "close";
  pressedClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-full transition-transform active:scale-90 ${pressed ? pressedClass : "bg-ink/5 text-ink/40"}`}
    >
      <Icon name={icon} size={14} strokeWidth={2.8} />
    </button>
  );
}

"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { computeRoundScores, type AnswerScore } from "@/lib/scoring";
import type { AnswerView, PlayerView } from "@/lib/types";
import { useGameContext } from "./GameContext";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./ui";

const CATEGORY_ICON: Record<string, IconName> = {
  human: "user",
  animal: "paw",
  plant: "leaf",
  object: "cube",
  country: "earth",
  city: "buildings",
  food: "bowl",
  brand: "tag",
  job: "briefcase",
  movie: "film",
  color: "palette",
  sport: "ball",
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

  return (
    <div className="flex flex-col gap-4">
      {round.categories.map((category) => (
        <section key={category} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold">
            <Icon name={CATEGORY_ICON[category] ?? "cube"} size={15} />
            {t(`categories.${category}`)}
          </h3>
          {participants.map((player) => {
            const answer = round.answers.find((a) => a.playerId === player.id && a.category === category);
            return (
              <AnswerRow key={player.id} mode={mode} player={player} answer={answer} score={answer ? preview.get(answer.id) : undefined} />
            );
          })}
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
  const { state, isHost, call, openProfile } = useGameContext();
  const { t } = useI18n();
  const mine = player.id === state.me.playerId;
  const hasValue = !!answer?.normalized;
  const valid = mode === "final" ? answer?.isValid === true : score?.isValid === true;
  const points = mode === "final" ? (answer?.points ?? 0) : (score?.points ?? 0);
  const duplicate = score?.duplicate === true;

  const statusColor = !hasValue || !valid ? "var(--color-pink)" : duplicate ? "var(--color-amber)" : "var(--color-mint)";
  const statusLabel = !hasValue
    ? t("vote.noAnswer")
    : !valid
      ? answer && !answer.autoValid
        ? t("vote.wrongLetter")
        : t("vote.rejected")
      : duplicate
        ? t("vote.duplicate")
        : t("vote.unique");

  return (
    <div
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[16px] border-2 border-line bg-card px-2.5 py-2 sm:flex-nowrap sm:px-3 sm:py-2.5"
      style={{ borderInlineStartWidth: 5, borderInlineStartColor: statusColor }}
    >
      <button type="button" onClick={() => openProfile(player.userId)} aria-label={player.username}>
        <Avatar name={player.username} url={player.avatarUrl} size={28} />
      </button>
      <div className="min-w-0 flex-1 basis-[55%]">
        <div className="truncate text-[14px] font-semibold" dir="auto">
          {hasValue ? answer!.value : "—"}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: statusColor }}>
          <span>{statusLabel}</span>
          <button type="button" className="text-sand hover:underline" onClick={() => openProfile(player.userId)}>
            · {player.username}
          </button>
          {answer?.hostVerdict != null && <span className="text-orange">· {t("vote.hostRuled")}</span>}
        </div>
      </div>

      {mode === "vote" && answer && hasValue && !mine && (
        <div className="ms-auto flex items-center gap-1" role="group" aria-label={t("vote.votes")}>
          <VoteButton
            pressed={answer.myVote === true}
            label={t("vote.approve")}
            icon="thumbsUp"
            count={answer.approvals}
            color="var(--color-mint)"
            onClick={() => void call("vote", { answerId: answer.id, approve: answer.myVote === true ? null : true })}
          />
          <VoteButton
            pressed={answer.myVote === false}
            label={t("vote.reject")}
            icon="thumbsDown"
            count={answer.rejections}
            color="var(--color-pink)"
            onClick={() => void call("vote", { answerId: answer.id, approve: answer.myVote === false ? null : false })}
          />
          {isHost && (
            <span className="ms-1 flex items-center gap-1 border-s-2 border-line ps-1.5">
              <VerdictButton
                pressed={answer.hostVerdict === true}
                label={t("vote.forceValid")}
                icon="check"
                color="var(--color-mint)"
                onClick={() => void call("verdict", { answerId: answer.id, verdict: answer.hostVerdict === true ? null : true })}
              />
              <VerdictButton
                pressed={answer.hostVerdict === false}
                label={t("vote.forceInvalid")}
                icon="close"
                color="var(--color-pink)"
                onClick={() => void call("verdict", { answerId: answer.id, verdict: answer.hostVerdict === false ? null : false })}
              />
            </span>
          )}
        </div>
      )}

      <div className="headline w-[42px] text-end text-[14px]" style={{ color: statusColor }}>
        +{points}
      </div>
    </div>
  );
}

function VoteButton({
  pressed,
  label,
  icon,
  count,
  color,
  onClick,
}: {
  pressed: boolean;
  label: string;
  icon: IconName;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-8 items-center gap-1 rounded-[22px] px-2 text-[12px] font-bold tabular-nums"
      style={{
        background: pressed ? "var(--color-line-soft)" : "transparent",
        color: pressed ? color : "var(--color-sand)",
      }}
    >
      <Icon name={icon} size={16} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

function VerdictButton({
  pressed,
  label,
  icon,
  color,
  onClick,
}: {
  pressed: boolean;
  label: string;
  icon: IconName;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-full"
      style={{ background: pressed ? color : "var(--color-cream)", color: pressed ? "#fff" : "var(--color-sand)" }}
    >
      <Icon name={icon} size={14} strokeWidth={2.6} />
    </button>
  );
}

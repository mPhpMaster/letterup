"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryEmoji } from "@/lib/categories";
import { computeRoundScores, type AnswerScore } from "@/lib/scoring";
import type { AnswerView, PlayerView } from "@/lib/types";
import { useGameContext } from "./GameContext";
import { Avatar } from "./ui";

/**
 * Answers grouped by category.
 *  - "vote":  live preview of validity/points, with 👍/👎 and host ✓/✗ controls
 *  - "final": scored values as stored on the server
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
        ).map((s) => [s.id, s]),
      ),
    [round.answers, round.votes],
  );

  const participants = state.players.filter(
    (p) => round.answers.some((a) => a.playerId === p.id) || round.submittedPlayerIds.includes(p.id),
  );

  return (
    <div className="space-y-3">
      {round.categories.map((category) => (
        <section key={category} className="card overflow-hidden p-0 sm:p-0">
          <h3 className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 font-bold">
            <span aria-hidden>{categoryEmoji(category)}</span>
            {t(`categories.${category}`)}
          </h3>
          <ul className="divide-y divide-line">
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
  const { state, isHost, call } = useGameContext();
  const { t } = useI18n();
  const mine = player.id === state.me.playerId;
  const hasValue = !!answer?.normalized;
  const valid = mode === "final" ? answer?.isValid === true : score?.isValid === true;
  const points = mode === "final" ? (answer?.points ?? 0) : (score?.points ?? 0);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      <div className="flex w-32 min-w-0 items-center gap-2 sm:w-40">
        <Avatar name={player.username} url={player.avatarUrl} size={28} />
        <span className="truncate text-sm text-muted">{player.username}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {answer && hasValue ? (
          <span dir="auto" className={`break-words text-base font-bold ${valid ? "" : "text-muted line-through decoration-bad/80 decoration-2"}`}>
            {answer.value}
          </span>
        ) : (
          <span className="text-sm italic text-muted">{t("vote.noAnswer")}</span>
        )}
        {answer && hasValue && !answer.autoValid && <span className="tag bg-warn/15 text-warn">{t("vote.wrongLetter")}</span>}
        {score?.duplicate && valid && <span className="tag bg-sun/15 text-sun">{t("vote.duplicate")}</span>}
        {answer?.hostVerdict != null && <span className="tag bg-brand/20 text-brand">👑 {t("vote.hostRuled")}</span>}
      </div>

      <div className="ms-auto flex items-center gap-2">
        {mode === "vote" && answer && hasValue && (
          <div role="group" aria-label={t("vote.votes")} className="flex items-center gap-1">
            <button
              type="button"
              className="vote-btn"
              data-kind="up"
              aria-pressed={answer.myVote === true}
              aria-label={t("vote.approve")}
              disabled={mine}
              onClick={() => void call("vote", { answerId: answer.id, approve: answer.myVote === true ? null : true })}
            >
              👍 <span>{answer.approvals}</span>
            </button>
            <button
              type="button"
              className="vote-btn"
              data-kind="down"
              aria-pressed={answer.myVote === false}
              aria-label={t("vote.reject")}
              disabled={mine}
              onClick={() => void call("vote", { answerId: answer.id, approve: answer.myVote === false ? null : false })}
            >
              👎 <span>{answer.rejections}</span>
            </button>
          </div>
        )}

        {mode === "vote" && isHost && answer && hasValue && (
          <div role="group" aria-label={t("vote.hostControls")} className="flex items-center gap-1 border-s border-line ps-2">
            <button
              type="button"
              className="verdict-btn"
              data-kind="valid"
              aria-pressed={answer.hostVerdict === true}
              title={t("vote.forceValid")}
              aria-label={t("vote.forceValid")}
              onClick={() => void call("verdict", { answerId: answer.id, verdict: answer.hostVerdict === true ? null : true })}
            >
              ✓
            </button>
            <button
              type="button"
              className="verdict-btn"
              data-kind="invalid"
              aria-pressed={answer.hostVerdict === false}
              title={t("vote.forceInvalid")}
              aria-label={t("vote.forceInvalid")}
              onClick={() => void call("verdict", { answerId: answer.id, verdict: answer.hostVerdict === false ? null : false })}
            >
              ✗
            </button>
          </div>
        )}

        <span
          className={`min-w-12 rounded-lg px-2 py-1 text-center text-sm font-extrabold tabular-nums ${
            points >= 10 ? "bg-good/15 text-good" : points > 0 ? "bg-sun/15 text-sun" : "bg-bad/10 text-bad"
          }`}
        >
          +{points}
        </span>
      </div>
    </li>
  );
}

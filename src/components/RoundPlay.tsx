"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { normalizeAnswer, startsWithLetter } from "@/lib/letters";
import { useServerNow } from "@/hooks/useGame";
import { useGameContext } from "./GameContext";
import { Icon, type IconName } from "./Icon";
import { Avatar, LetterTile, TimerRing } from "./ui";

const AUTOSAVE_MS = 1_000;
const REFRESH_AFTER_TIMEUP_MS = 2_600; // just past the server's answer grace window

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

export function RoundPlay() {
  const { state, isHost, offset, call, refresh } = useGameContext();
  const { t } = useI18n();
  const round = state.round!;
  const now = useServerNow(offset);

  const [drafts, setDrafts] = useState<Record<string, string>>(() => ({ ...round.myAnswers }));
  const draftsRef = useRef(drafts);
  const dirty = useRef(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const phase = now < round.startedAt ? "reveal" : now < round.endsAt ? "answer" : "timeup";
  const submitted = round.submittedPlayerIds.includes(state.me.playerId);
  const locked = submitted || phase !== "answer";

  const save = useCallback(
    (submit: boolean) => {
      dirty.current = false;
      return call("answers", { roundId: round.id, answers: draftsRef.current, submit }, { silent: !submit });
    },
    [call, round.id],
  );

  // Debounced auto-save so whatever is typed survives the timer.
  useEffect(() => {
    if (!dirty.current || locked) return;
    const id = setTimeout(() => void save(false), AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [drafts, locked, save]);

  // Time's up: flush the latest drafts, then let the server close the round.
  const flushed = useRef(false);
  useEffect(() => {
    if (phase !== "timeup" || flushed.current) return;
    flushed.current = true;
    if (!submitted) void save(false);
    setTimeout(() => void refresh(), REFRESH_AFTER_TIMEUP_MS);
  }, [phase, submitted, save, refresh]);

  useEffect(() => {
    if (phase === "answer" && !submitted) inputs.current[0]?.focus();
  }, [phase, submitted]);

  const setDraft = (category: string, value: string) => {
    dirty.current = true;
    const next = { ...draftsRef.current, [category]: value };
    draftsRef.current = next;
    setDrafts(next);
  };

  const activePlayers = state.players.filter((p) => p.online || round.submittedPlayerIds.includes(p.id));

  if (phase === "reveal") {
    const count = Math.max(1, Math.ceil((round.startedAt - now) / 1000));
    return (
      <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-5 text-center">
        <p className="text-[12px] font-bold tracking-wider text-muted uppercase">{t("play.getReady")}</p>
        <LetterTile letter={round.letter} size={130} animate />
        <p className="text-sm text-muted">{t("play.letterIs")}</p>
        <p key={count} className="headline animate-pop-letter text-5xl text-pink tabular-nums">
          {count}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-rise flex flex-col items-center gap-4">
      <p className="text-[12px] font-bold tracking-wider text-muted uppercase">{t("play.letterIs")}</p>
      <LetterTile letter={round.letter} size={100} />
      <TimerRing remainingMs={round.endsAt - now} totalMs={round.endsAt - round.startedAt} />

      <div className="flex flex-wrap justify-center gap-2">
        {activePlayers.map((p) => {
          const done = round.submittedPlayerIds.includes(p.id);
          return (
            <span key={p.id} className="relative" title={p.username}>
              <Avatar name={p.username} url={p.avatarUrl} size={36} dim={!done} />
              {done && (
                <span className="animate-check-pop absolute -end-1 -bottom-1 grid size-4 place-items-center rounded-full border-2 border-cream bg-mint">
                  <Icon name="check" size={9} className="text-mint-deep" strokeWidth={3.5} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      <p className="-mt-2 text-[12px] text-muted">{t("play.progress", { done: round.submittedPlayerIds.length, total: activePlayers.length })}</p>

      {phase === "timeup" && (
        <div className="card w-full border-sun text-center">
          <p className="headline text-xl text-orange">{t("play.timeUp")}</p>
          <p className="text-sm text-muted">{t("play.collecting")}</p>
        </div>
      )}

      <form
        className="flex w-full flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked) void save(true);
        }}
      >
        {round.categories.map((category, i) => {
          const value = drafts[category] ?? "";
          const hasValue = value.trim() !== "";
          const matches = hasValue && startsWithLetter(normalizeAnswer(value), round.letter);
          return (
            <div key={category}>
              <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                <Icon name={CATEGORY_ICON[category] ?? "cube"} size={15} />
                {t(`categories.${category}`)}
                {hasValue && (
                  <span className={`ms-auto text-[11px] font-bold ${matches ? "text-mint" : "text-amber"}`}>
                    {matches ? "✓" : t("play.wrongLetter", { letter: round.letter })}
                  </span>
                )}
              </label>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                className="input"
                dir="auto"
                lang={round.letterLocale}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={60}
                enterKeyHint={i === round.categories.length - 1 ? "done" : "next"}
                placeholder={t("play.placeholder", { letter: round.letter })}
                value={value}
                disabled={locked}
                onChange={(e) => setDraft(category, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && i < round.categories.length - 1) {
                    e.preventDefault();
                    inputs.current[i + 1]?.focus();
                  }
                }}
              />
            </div>
          );
        })}

        <div className="sticky bottom-3 z-10 flex flex-wrap gap-2">
          <button type="submit" className={`btn flex-1 text-base ${locked ? "btn-disabled" : "btn-primary"}`} disabled={locked}>
            <Icon name="checkCircle" size={18} />
            {submitted ? t("play.submitted") : t("play.done")}
          </button>
          {isHost && phase === "answer" && (
            <button type="button" className="btn btn-ghost" onClick={() => void call("endRound")}>
              {t("play.endNow")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

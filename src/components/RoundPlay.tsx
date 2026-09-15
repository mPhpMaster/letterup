"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryEmoji } from "@/lib/categories";
import { normalizeAnswer, startsWithLetter } from "@/lib/letters";
import { useServerNow } from "@/hooks/useGame";
import { useGameContext } from "./GameContext";
import { Avatar, LetterTile, TimerRing } from "./ui";

const AUTOSAVE_MS = 1_000;
const REFRESH_AFTER_TIMEUP_MS = 2_600; // just past the server's answer grace window

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

  // Debounced auto-save so "whatever they've typed" survives the timer.
  useEffect(() => {
    if (!dirty.current || locked) return;
    const id = setTimeout(() => void save(false), AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [drafts, locked, save]);

  // Time's up: flush the latest drafts immediately, then ask the server to close the round.
  const flushed = useRef(false);
  useEffect(() => {
    if (phase !== "timeup" || flushed.current) return;
    flushed.current = true;
    if (!submitted) void save(false);
    setTimeout(() => void refresh(), REFRESH_AFTER_TIMEUP_MS);
  }, [phase, submitted, save, refresh]);

  // Focus the first field when answering opens.
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
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 text-center">
        <p className="text-lg font-bold text-muted">{t("play.getReady")}</p>
        <LetterTile letter={round.letter} size={150} animate />
        <p className="text-sm text-muted">{t("play.letterIs")}</p>
        <p key={count} className="animate-pop text-5xl font-black tabular-nums text-sun">
          {count}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-4">
      <div className="card flex items-center gap-4">
        <LetterTile letter={round.letter} size={68} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("play.letterIs")}</p>
          <p className="truncate text-sm text-muted">{t("play.progress", { done: round.submittedPlayerIds.length, total: activePlayers.length })}</p>
          <div className="mt-1.5 flex -space-x-2 rtl:space-x-reverse">
            {activePlayers.map((p) => (
              <span key={p.id} className={`rounded-full ring-2 ${round.submittedPlayerIds.includes(p.id) ? "ring-good" : "ring-surface"}`} title={p.username}>
                <Avatar name={p.username} url={p.avatarUrl} size={26} dim={!round.submittedPlayerIds.includes(p.id)} />
              </span>
            ))}
          </div>
        </div>
        <TimerRing remainingMs={round.endsAt - now} totalMs={round.endsAt - round.startedAt} />
      </div>

      {phase === "timeup" && (
        <div className="card border-sun/40 text-center">
          <p className="text-xl font-extrabold text-sun">{t("play.timeUp")}</p>
          <p className="text-sm text-muted">{t("play.collecting")}</p>
        </div>
      )}
      {phase === "answer" && submitted && (
        <div className="card border-good/40 text-center">
          <p className="text-lg font-extrabold text-good">✓ {t("play.submitted")}</p>
        </div>
      )}

      <form
        className="grid gap-3 sm:grid-cols-2"
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
            <label key={category} className="card block p-3 sm:p-3.5">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold">
                <span aria-hidden className="text-lg">
                  {categoryEmoji(category)}
                </span>
                {t(`categories.${category}`)}
                {hasValue && (
                  <span className={`ms-auto text-xs font-bold ${matches ? "text-good" : "text-warn"}`}>
                    {matches ? "✓" : `⚠ ${t("play.wrongLetter", { letter: round.letter })}`}
                  </span>
                )}
              </span>
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
            </label>
          );
        })}

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="submit" className="btn btn-good flex-1 text-lg shadow-xl" disabled={locked}>
            {t("play.done")} ✓
          </button>
          {isHost && phase === "answer" && (
            <button type="button" className="btn shadow-xl" onClick={() => void call("endRound")}>
              {t("play.endNow")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

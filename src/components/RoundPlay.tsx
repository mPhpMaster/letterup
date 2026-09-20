"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { normalizeAnswer, startsWithLetter } from "@/lib/letters";
import { useSound } from "@/lib/sound";
import { useServerNow } from "@/hooks/useGame";
import { useSpeechInput, type SpeechError } from "@/hooks/useSpeechInput";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, CategoryTile, ConfirmButton, LetterTile, TimerRing } from "./ui";

const AUTOSAVE_MS = 1_000;
const REFRESH_AFTER_TIMEUP_MS = 2_600; // just past the server's answer grace window

export function RoundPlay() {
  const { state, isHost, offset, call, refresh, openProfile } = useGameContext();
  const { t } = useI18n();
  const { play } = useSound();
  const round = state.round!;
  const now = useServerNow(offset);

  const [drafts, setDrafts] = useState<Record<string, string>>(() => ({ ...round.myAnswers }));
  const draftsRef = useRef(drafts);
  const dirty = useRef(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const phase = now < round.startedAt ? "reveal" : now < round.endsAt ? "answer" : "timeup";
  const submitted = round.submittedPlayerIds.includes(state.me.playerId);
  const locked = submitted || phase !== "answer";
  // Categories left blank when "Done" was pressed: ask before locking them in.
  const [emptyWarning, setEmptyWarning] = useState<string[] | null>(null);
  useEffect(() => {
    if (phase !== "answer") setEmptyWarning(null);
  }, [phase]);

  const save = useCallback(
    (submit: boolean) => {
      dirty.current = false;
      return call(
        "answers",
        { roundId: round.id, answers: draftsRef.current, submit },
        {
          silent: !submit,
          // Lock the fields on the tap, not a round trip later.
          optimistic: submit
            ? (s) =>
                s.round && !s.round.submittedPlayerIds.includes(s.me.playerId)
                  ? { ...s, round: { ...s.round, submittedPlayerIds: [...s.round.submittedPlayerIds, s.me.playerId] } }
                  : s
            : undefined,
        },
      );
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

  // Sound cues: a flourish when the letter lands (this screen is keyed by round), then
  // a tick for each of the last five seconds.
  useEffect(() => {
    play("reveal");
  }, [play]);

  const secondsLeft = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "answer" || secondsLeft > 5 || secondsLeft === 0 || lastTick.current === secondsLeft) return;
    lastTick.current = secondsLeft;
    play("tick");
  }, [phase, secondsLeft, play]);

  const submit = () => {
    setEmptyWarning(null);
    play("submit");
    void save(true);
  };

  // Take "Done" back to change something -- only while the clock is still running.
  const unsubmit = () => {
    play("click");
    void call(
      "unsubmit",
      { roundId: round.id },
      {
        optimistic: (s) =>
          s.round ? { ...s, round: { ...s.round, submittedPlayerIds: s.round.submittedPlayerIds.filter((id) => id !== s.me.playerId) } } : s,
      },
    );
  };

  const setDraft = (category: string, value: string) => {
    dirty.current = true;
    const next = { ...draftsRef.current, [category]: value };
    draftsRef.current = next;
    setDrafts(next);
  };

  // Voice answers, in the round's language. Only offered where the browser can do it.
  const [speechNote, setSpeechNote] = useState<SpeechError | null>(null);
  const speech = useSpeechInput(round.letterLocale, setDraft, setSpeechNote);
  const stopSpeech = speech.stop;
  useEffect(() => {
    if (locked) stopSpeech();
  }, [locked, stopSpeech]);
  useEffect(() => {
    if (!speechNote) return;
    const id = setTimeout(() => setSpeechNote(null), 3500);
    return () => clearTimeout(id);
  }, [speechNote]);

  const activePlayers = state.players.filter((p) => p.online || round.submittedPlayerIds.includes(p.id));
  const doneCount = round.submittedPlayerIds.length;

  if (phase === "reveal") {
    const count = Math.max(1, Math.ceil((round.startedAt - now) / 1000));
    return (
      <section className="card-pop animate-rise mx-auto flex min-h-[55dvh] w-full max-w-3xl flex-col items-center justify-center gap-6 text-center">
        <p className="kicker">{t("play.getReady")}</p>
        <LetterTile letter={round.letter} size={170} animate />
        <p className="headline text-lg text-ink/60">{t("play.letterIs")}</p>
        <p key={count} className="headline animate-pop-letter grid size-16 place-items-center rounded-full bg-ink text-4xl text-cream tabular-nums">
          {count}
        </p>
      </section>
    );
  }

  return (
    <section className="card-pop animate-rise mx-auto flex w-full max-w-3xl flex-col gap-5">
      {/* Stays pinned while the fields scroll, so the clock is always in sight. On short
          panels (phones, Discord's desktop panel) the letter rides in this row too; only
          roomy screens get the big centred tile below. */}
      <div className="sticky top-2 z-20 -mx-2 flex items-center gap-3 rounded-3xl bg-paper/95 p-2 backdrop-blur">
        <span className="tall:hidden">
          <LetterTile letter={round.letter} size={64} animate />
        </span>
        <div className="min-w-0 flex-1">
          <p className="headline text-sm text-ink/50">
            {/* The header drops its round badge on narrow panels, so say it here. */}
            <span className="md:hidden">{t("header.roundLong", { current: round.number, total: state.settings.totalRounds })} · </span>
            {t("play.letterIs")}
          </p>
          <p className="headline text-base leading-tight sm:text-lg">{t("play.beatTheClock")}</p>
        </div>
        <span
          className={`hidden rounded-full px-3 py-1 text-xs font-extrabold sm:block ${
            secondsLeft <= 5 && phase === "answer" ? "bg-brand/15 text-brand" : "bg-mint/15 text-mint-deep"
          }`}
        >
          {t("play.secondsLeft", { seconds: secondsLeft })}
        </span>
        <TimerRing remainingMs={round.endsAt - now} totalMs={round.endsAt - round.startedAt} size={60} />
      </div>

      <div className="hidden justify-center py-2 tall:flex">
        <LetterTile letter={round.letter} size={150} animate />
      </div>

      {phase === "timeup" && (
        <div className="animate-rise rounded-3xl bg-accent/25 p-4 text-center">
          <p className="headline text-2xl text-brand">{t("play.timeUp")}</p>
          <p className="text-sm font-bold text-ink/60">{t("play.collecting")}</p>
        </div>
      )}

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (locked) return;
          const empty = round.categories.filter((c) => !(draftsRef.current[c] ?? "").trim());
          if (empty.length > 0) {
            setEmptyWarning(empty);
            return;
          }
          submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {round.categories.map((category, i) => {
            const value = drafts[category] ?? "";
            const hasValue = value.trim() !== "";
            const matches = hasValue && startsWithLetter(normalizeAnswer(value), round.letter);
            const name = t(`categories.${category}`);
            return (
              <label
                key={category}
                className={`flex items-center gap-3 rounded-2xl bg-cream p-3 outline-1 outline-ink/10 focus-within:outline-2 focus-within:outline-brand ${locked ? "opacity-80" : ""}`}
              >
                <CategoryTile id={category} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="kicker truncate">{name}</span>
                    {hasValue && (
                      <span className={`ms-auto shrink-0 text-[11px] font-extrabold ${matches ? "text-mint-deep" : "text-brand"}`}>
                        {matches ? "✓" : t("play.wrongLetter", { letter: round.letter })}
                      </span>
                    )}
                  </span>
                  <input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    className="w-full min-w-0 bg-transparent text-base font-bold outline-none placeholder:font-semibold placeholder:text-ink/30 disabled:text-ink/60"
                    dir="auto"
                    lang={round.letterLocale}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={60}
                    enterKeyHint={i === round.categories.length - 1 ? "done" : "next"}
                    placeholder={t("play.placeholder", { letter: round.letter })}
                    aria-label={name}
                    value={value}
                    disabled={locked}
                    // Mobile keyboards cover the lower half of the screen; keep the focused field visible.
                    onFocus={(e) => {
                      const field = e.currentTarget;
                      setTimeout(() => field.scrollIntoView({ block: "nearest", behavior: "smooth" }), 250);
                    }}
                    onChange={(e) => setDraft(category, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && i < round.categories.length - 1) {
                        e.preventDefault();
                        inputs.current[i + 1]?.focus();
                      }
                    }}
                  />
                </span>
                {speech.supported && !locked && (
                  <button
                    type="button"
                    className={`grid size-10 shrink-0 place-items-center rounded-2xl transition-colors ${
                      speech.listening === category ? "animate-pulse-soft bg-brand text-white" : "bg-paper text-ink/55 hover:text-brand"
                    }`}
                    aria-label={speech.listening === category ? t("play.voiceStop") : t("play.voice", { category: name })}
                    title={speech.listening === category ? t("play.voiceStop") : t("play.voice", { category: name })}
                    aria-pressed={speech.listening === category}
                    onClick={(e) => {
                      e.preventDefault(); // inside the <label>: don't also focus the input
                      setSpeechNote(null);
                      if (speech.listening === category) speech.stop();
                      else speech.start(category);
                    }}
                  >
                    <Icon name="mic" size={19} />
                  </button>
                )}
              </label>
            );
          })}
        </div>

        {(speech.listening || speechNote) && (
          <p role="status" className="animate-rise rounded-2xl bg-ink px-4 py-2.5 text-center text-sm font-bold text-cream">
            {speech.listening ? `🎙️ ${t("play.voiceListening", { category: t(`categories.${speech.listening}`) })}` : t(`play.voiceError.${speechNote}`)}
          </p>
        )}

        {emptyWarning && (
          <div role="alertdialog" aria-live="assertive" className="animate-rise rounded-3xl bg-accent/25 p-4 outline-2 outline-accent">
            <p className="headline text-lg text-ink">⚠️ {t("play.emptyTitle", { count: emptyWarning.length })}</p>
            <p className="mt-1 text-sm font-bold text-ink/70">{emptyWarning.map((c) => t(`categories.${c}`)).join(t("final.listSeparator"))}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ink flex-1"
                onClick={() => {
                  const first = round.categories.indexOf(emptyWarning[0]);
                  setEmptyWarning(null);
                  inputs.current[first]?.focus();
                }}
              >
                {t("play.keepWriting")}
              </button>
              <button type="button" className="btn btn-ghost flex-1" onClick={submit}>
                {t("play.submitAnyway")}
              </button>
            </div>
          </div>
        )}

        {/* From sm up the whole bar pins to the bottom; it carries its own background so
            answers scrolling underneath never show through. */}
        <div className="z-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl sm:sticky sm:bottom-3 sm:bg-paper/95 sm:p-2 sm:shadow-[0_6px_0_var(--color-edge)] sm:backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {activePlayers.map((p) => {
                const done = round.submittedPlayerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="relative rounded-full ring-2 ring-paper"
                    title={p.username}
                    aria-label={p.username}
                    onClick={() => openProfile(p.userId)}
                  >
                    <Avatar name={p.username} url={p.avatarUrl} size={36} dim={!done} />
                    {done && (
                      <span className="animate-check-pop absolute -end-1 -bottom-1 grid size-4 place-items-center rounded-full bg-mint text-[9px] font-bold text-ink ring-2 ring-paper">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-sm font-bold text-ink/60">{t("play.progress", { done: doneCount, total: activePlayers.length })}</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {isHost && phase === "answer" && (
              <>
                <ConfirmButton className="btn btn-ghost" onConfirm={() => void call("endGame")}>
                  <Icon name="trophy" size={16} />
                  {t("header.endGame")}
                </ConfirmButton>
                <ConfirmButton className="btn btn-ghost" onConfirm={() => void call("endRound")}>
                  {t("play.endNow")}
                </ConfirmButton>
              </>
            )}
            {submitted && phase === "answer" ? (
              <button type="button" className="btn btn-mint flex-1 px-6 text-lg sm:flex-none" onClick={unsubmit}>
                <Icon name="checkCircle" size={20} />
                <span className="flex flex-col items-start leading-tight">
                  {t("play.submitted")}
                  <span className="text-xs font-bold opacity-70">{t("play.tapToEdit")}</span>
                </span>
              </button>
            ) : (
              <button type="submit" className="btn btn-brand flex-1 px-8 text-lg sm:flex-none" disabled={locked}>
                <Icon name="checkCircle" size={20} />
                {submitted ? t("play.submitted") : t("play.done")}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

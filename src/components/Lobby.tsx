"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { CATEGORIES, CATEGORY_IDS, DEFAULT_CATEGORIES } from "@/lib/categories";
import { HARD_LETTERS } from "@/lib/letters";
import { useSound } from "@/lib/sound";
import type { SettingsView } from "@/lib/types";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, ConfirmButton, PlayerName } from "./ui";

const DURATIONS = [15, 30, 45, 60, 90];
const ROUND_COUNTS = [3, 5, 10];

export function Lobby() {
  const { state, me, isHost, hostName, participantIds, call, openProfile, openFriends, copyInvite, openDiscordInvite, leaveRoom } =
    useGameContext();
  const { t, locale } = useI18n();
  const { play } = useSound();
  const settings = state.settings;
  const players = state.players;
  const readyCount = players.filter((p) => p.ready || p.isHost).length;
  const canStart = settings.categories.length > 0;

  // Chips and toggles used to sit unchanged until the server answered; show the new
  // setting straight away and let the reply confirm it.
  const update = (patch: Partial<SettingsView>) => {
    play("select");
    void call("settings", { patch }, { optimistic: (s) => ({ ...s, settings: { ...s.settings, ...patch } }) });
  };
  const toggleCategory = (id: string) => {
    const on = settings.categories.includes(id);
    if (on && settings.categories.length === 1) return;
    update({ categories: on ? settings.categories.filter((c) => c !== id) : [...settings.categories, id] });
  };

  return (
    <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-3">
      <section className="card-pop animate-rise flex flex-col gap-4">
        <div className="text-center">
          {state.game.roomCode ? (
            <>
              <p className="text-sm font-bold text-ink/50">{t("lobby.roomCode")}</p>
              <p className="headline animate-pulse-soft text-4xl tracking-[0.2em] text-brand" dir="ltr">
                {state.game.roomCode}
              </p>
            </>
          ) : (
            <p className="headline text-3xl">{t("lobby.title")} 🎈</p>
          )}
          <p className="mt-2 text-[13px] font-semibold text-muted">{state.game.roomCode ? t("lobby.inviteWeb") : t("lobby.invite")}</p>
        </div>

        <div className="flex flex-col gap-2">
          {/* Inside the Activity, Discord's own dialog is the shortest way to pull in
              someone who is already in the server. */}
          {openDiscordInvite && (
            <button type="button" className="btn btn-discord btn-sm" onClick={openDiscordInvite}>
              <Icon name="discord" size={18} />
              {t("lobby.inviteDiscord")}
            </button>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <button type="button" className="btn btn-accent btn-sm" onClick={openFriends}>
              <Icon name="userPlus" size={16} />
              {t("lobby.inviteFriends")}
            </button>
            {copyInvite && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={copyInvite}>
                <Icon name="link" size={16} />
                {t("lobby.copyLink")}
              </button>
            )}
          </div>
        </div>

        <div>
          <h2 className="headline text-lg">
            {t("lobby.playersHeading")} · {players.length}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {players.map((p, i) => {
              const online = p.online || participantIds.has(p.userId);
              return (
                <li
                  key={p.id}
                  className="animate-rise flex items-center gap-3 rounded-2xl bg-cream p-2.5 outline-1 outline-ink/5"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <Avatar name={p.username} url={p.avatarUrl} size={40} dim={!online} />
                  <span className="flex min-w-0 flex-1 text-sm">
                    <PlayerName player={p} meId={state.me.playerId} showCrown={!online} onClick={() => openProfile(p.userId)} />
                  </span>
                  {!online ? (
                    <span className="shrink-0 text-[11px] font-extrabold text-ink/40">{t("common.away")}</span>
                  ) : p.isHost ? (
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-ink uppercase">
                      {t("common.host")}
                    </span>
                  ) : p.ready ? (
                    <span className="animate-score-pop shrink-0 rounded-full bg-mint px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-ink uppercase">
                      {t("common.ready")}
                    </span>
                  ) : null}
                  {isHost && p.id !== state.me.playerId && (
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform active:scale-90"
                      title={t("lobby.kick")}
                      aria-label={t("lobby.kick")}
                      onClick={() => void call("kick", { playerId: p.id })}
                    >
                      <Icon name="close" size={15} strokeWidth={2.6} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <ConfirmButton className="btn btn-ghost btn-sm self-center" onConfirm={leaveRoom}>
          <Icon name="signOut" size={15} />
          {t("lobby.leave")}
        </ConfirmButton>
      </section>

      <section className="card-pop animate-rise flex flex-col gap-5 lg:col-span-2" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-3">
          <h2 className="headline min-w-0 flex-1 truncate text-xl">{t("lobby.settings")}</h2>
          {!isHost && (
            <span className="pill min-w-0 text-end text-[10px] text-ink/50">{t("lobby.hostOnly")}</span>
          )}
        </div>

        <fieldset disabled={!isHost} className="flex min-w-0 flex-col gap-5">
          <Setting label={t("lobby.roundDuration")}>
            <Chips
              options={DURATIONS}
              value={settings.roundSeconds}
              min={10}
              max={300}
              format={(v) => t("lobby.secondsShort", { value: v })}
              onChange={(roundSeconds) => update({ roundSeconds })}
            />
          </Setting>

          <Setting label={t("lobby.rounds")}>
            <Chips options={ROUND_COUNTS} value={settings.totalRounds} min={1} max={20} format={String} onChange={(totalRounds) => update({ totalRounds })} />
          </Setting>

          <Setting label={t("lobby.letters")}>
            <div className="seg">
              <button type="button" className="seg-item" aria-pressed={settings.letterLocale === "en"} onClick={() => update({ letterLocale: "en" })}>
                {t("lobby.lettersEn")}
              </button>
              <button type="button" className="seg-item" aria-pressed={settings.letterLocale === "ar"} onClick={() => update({ letterLocale: "ar" })}>
                {t("lobby.lettersAr")}
              </button>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-3 outline-1 outline-ink/10">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-mint"
                aria-label={t("lobby.excludeHard")}
                checked={settings.excludeHardLetters}
                onChange={(e) => update({ excludeHardLetters: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-extrabold">{t("lobby.excludeHard")}</span>
                <span className="block text-xs font-semibold text-muted">
                  {t("lobby.excludeHardHint", { letters: HARD_LETTERS[settings.letterLocale].join(locale === "ar" ? "، " : ", ") })}
                </span>
              </span>
            </label>
          </Setting>

          <Setting
            label={t("lobby.categories")}
            aside={
              <span className="flex items-center gap-1.5">
                <button type="button" className="seg-item px-3! py-1.5! text-xs!" onClick={() => update({ categories: [...CATEGORY_IDS] })}>
                  {t("lobby.selectAll")}
                </button>
                <button type="button" className="seg-item px-3! py-1.5! text-xs!" onClick={() => update({ categories: DEFAULT_CATEGORIES })}>
                  {t("lobby.defaults")}
                </button>
              </span>
            }
          >
            <p className="mb-2.5 text-xs font-semibold text-muted">
              {t("lobby.selected", { count: settings.categories.length, total: CATEGORIES.length })} · {t("lobby.needCategory")}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
              {CATEGORIES.map((c) => {
                const on = settings.categories.includes(c.id);
                return (
                  <button key={c.id} type="button" className="cat-option" data-on={on} aria-pressed={on} onClick={() => toggleCategory(c.id)}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper text-lg">{c.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{t(`categories.${c.id}`)}</span>
                    <span
                      aria-hidden
                      className={`grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold ${on ? "bg-mint text-ink" : "bg-ink/5 text-transparent"}`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </Setting>
        </fieldset>

        {isHost ? (
          <div>
            {/* Waiting for everyone is the host's call, not a rule -- but starting on
                someone who is still typing their name in should take a second tap. */}
            {canStart && readyCount < players.length ? (
              <ConfirmButton
                className="btn btn-brand w-full py-4 text-xl"
                onConfirm={() => {
                  play("reveal");
                  void call("start");
                }}
              >
                {t("lobby.start")} 🎉
              </ConfirmButton>
            ) : (
              <button
                type="button"
                className="btn btn-brand w-full py-4 text-xl"
                disabled={!canStart}
                onClick={() => {
                  play("reveal");
                  void call("start");
                }}
              >
                {t("lobby.start")} 🎉
              </button>
            )}
            <p className="mt-3 text-center text-xs font-bold text-muted">
              {!canStart
                ? t("lobby.needCategory")
                : readyCount < players.length
                  ? t("lobby.startAnyway", { ready: readyCount, total: players.length })
                  : t("lobby.readyCount", { ready: readyCount, total: players.length })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className={`btn w-full py-3.5 text-lg ${me?.ready ? "btn-mint" : "btn-brand"}`}
              onClick={() => {
                play(me?.ready ? "click" : "submit");
                void call(
                  "ready",
                  { ready: !me?.ready },
                  {
                    optimistic: (s) => ({
                      ...s,
                      players: s.players.map((p) => (p.id === s.me.playerId ? { ...p, ready: !me?.ready } : p)),
                    }),
                  },
                );
              }}
            >
              <Icon name={me?.ready ? "checkCircle" : "check"} size={20} />
              {me?.ready ? t("lobby.readyOn") : t("lobby.imReady")}
            </button>
            <div className="waiting">
              <p className="animate-pulse-soft">{t("lobby.waitingHost", { name: hostName })}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Setting({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="kicker">{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  min,
  max,
  format,
  onChange,
}: {
  options: number[];
  value: number;
  min: number;
  max: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || draft.trim() === "") return setDraft(String(value));
    const clamped = Math.min(max, Math.max(min, n));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  const custom = !options.includes(value);
  return (
    <div className="seg items-center">
      {options.map((o) => (
        <button key={o} type="button" className="seg-item tabular-nums" aria-pressed={o === value} onClick={() => onChange(o)}>
          {format(o)}
        </button>
      ))}
      <label
        className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${custom ? "bg-ink text-cream" : "bg-cream text-ink/60 outline-1 outline-ink/10"}`}
      >
        <span className="text-xs">{t("lobby.custom")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="headline w-10 bg-transparent text-center tabular-nums outline-none"
          dir="ltr"
        />
      </label>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { CATEGORIES, CATEGORY_IDS, DEFAULT_CATEGORIES } from "@/lib/categories";
import { HARD_LETTERS } from "@/lib/letters";
import type { SettingsView } from "@/lib/types";
import { useGameContext } from "./GameContext";
import { Icon, type IconName } from "./Icon";
import { Avatar, ConfirmButton, PlayerName } from "./ui";

const DURATIONS = [15, 30, 45, 60, 90];
const ROUND_COUNTS = [3, 5, 10];

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

export function Lobby() {
  const { state, me, isHost, hostName, participantIds, call, openProfile, openFriends, copyInvite, leaveRoom } = useGameContext();
  const { t, locale } = useI18n();
  const settings = state.settings;
  const players = state.players;
  const readyCount = players.filter((p) => p.ready || p.isHost).length;

  const update = (patch: Partial<SettingsView>) => void call("settings", { patch });
  const toggleCategory = (id: string) => {
    const on = settings.categories.includes(id);
    if (on && settings.categories.length === 1) return;
    update({ categories: on ? settings.categories.filter((c) => c !== id) : [...settings.categories, id] });
  };

  return (
    <div className="animate-rise flex flex-col gap-4">
      <div>
        <h1 className="headline text-[28px]">{t("lobby.title")} 🎈</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {state.game.roomCode && (
            <span className="pill tracking-[0.12em] text-orange" dir="ltr">
              {state.game.roomCode}
            </span>
          )}
          <span className="text-[13px] text-muted">{t("lobby.players", { count: players.length })}</span>
        </div>
        <p className="mt-1 text-[13px] text-muted">{state.game.roomCode ? t("lobby.inviteWeb") : t("lobby.invite")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline min-w-[140px] flex-1 btn-sm" onClick={openFriends}>
          <Icon name="userPlus" size={16} />
          {t("lobby.inviteFriends")}
        </button>
        {copyInvite && (
          <button type="button" className="btn btn-ghost min-w-[140px] flex-1 btn-sm" onClick={copyInvite}>
            <Icon name="link" size={16} />
            {t("lobby.copyLink")}
          </button>
        )}
      </div>

      <div className="card flex flex-col gap-2">
        {players.map((p) => {
          const online = p.online || participantIds.has(p.userId);
          return (
            <div key={p.id} className="flex items-center gap-3 px-1 py-1.5">
              <Avatar name={p.username} url={p.avatarUrl} dim={!online} />
              <span className="min-w-0 flex-1">
                <PlayerName player={p} meId={state.me.playerId} onClick={() => openProfile(p.userId)} />
              </span>
              {!online ? (
                <span className="text-[11px] font-bold text-sand">{t("common.away")}</span>
              ) : p.ready || p.isHost ? (
                <span className="pill" style={{ background: "var(--color-mint)", borderColor: "transparent", color: "var(--color-mint-deep)" }}>
                  {p.isHost ? t("common.host") : t("common.ready")}
                </span>
              ) : null}
              {isHost && p.id !== state.me.playerId && (
                <button
                  type="button"
                  className="btn btn-icon"
                  style={{ background: "var(--color-line-soft)", color: "var(--color-pink)" }}
                  title={t("lobby.kick")}
                  aria-label={t("lobby.kick")}
                  onClick={() => void call("kick", { playerId: p.id })}
                >
                  <Icon name="closeCircle" size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <fieldset disabled={!isHost} className="card flex flex-col gap-4">
        <h3 className="headline text-[18px]">{t("lobby.settings")}</h3>

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
          <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-orange"
              checked={settings.excludeHardLetters}
              onChange={(e) => update({ excludeHardLetters: e.target.checked })}
            />
            <span>
              <span className="block text-[13px] font-semibold">{t("lobby.excludeHard")}</span>
              <span className="block text-[11px] text-muted">
                {t("lobby.excludeHardHint", { letters: HARD_LETTERS[settings.letterLocale].join(locale === "ar" ? "، " : ", ") })}
              </span>
            </span>
          </label>
        </Setting>

        <Setting
          label={t("lobby.categories")}
          aside={
            <span className="flex items-center gap-1.5">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ categories: [...CATEGORY_IDS] })}>
                {t("lobby.selectAll")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ categories: DEFAULT_CATEGORIES })}>
                {t("lobby.defaults")}
              </button>
            </span>
          }
        >
          <p className="mb-2 text-[11px] text-muted">
            {t("lobby.selected", { count: settings.categories.length, total: CATEGORIES.length })} · {t("lobby.needCategory")}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
            {CATEGORIES.map((c) => {
              const on = settings.categories.includes(c.id);
              return (
                <button key={c.id} type="button" className="cat-option" data-on={on} onClick={() => toggleCategory(c.id)}>
                  <Icon name={CATEGORY_ICON[c.id] ?? "cube"} size={16} />
                  <span className="min-w-0 flex-1 truncate">{t(`categories.${c.id}`)}</span>
                  {on && <Icon name="checkCircle" size={15} />}
                </button>
              );
            })}
          </div>
        </Setting>

        {!isHost && <p className="text-[12px] text-muted">{t("lobby.hostOnly")}</p>}
      </fieldset>

      {isHost ? (
        <>
          <button
            type="button"
            className={`btn text-base ${settings.categories.length === 0 ? "btn-disabled" : "btn-primary"}`}
            disabled={settings.categories.length === 0}
            onClick={() => void call("start")}
          >
            <Icon name="play" size={18} filled />
            {t("lobby.start")} 🎉
          </button>
          <p className="text-center text-[11px] text-muted">{t("lobby.readyCount", { ready: readyCount, total: players.length })}</p>
        </>
      ) : (
        <>
          <button type="button" className={`btn ${me?.ready ? "btn-mint" : "btn-primary"}`} onClick={() => void call("ready", { ready: !me?.ready })}>
            <Icon name={me?.ready ? "checkCircle" : "check"} size={18} />
            {me?.ready ? t("lobby.readyOn") : t("lobby.imReady")}
          </button>
          <div className="waiting">
            <Icon name="hourglass" size={16} className="me-1.5 inline" />
            {t("lobby.waitingHost", { name: hostName })}
          </div>
        </>
      )}

      <ConfirmButton className="btn btn-ghost btn-sm self-center" onConfirm={leaveRoom}>
        <Icon name="signOut" size={15} />
        {t("lobby.leave")}
      </ConfirmButton>
    </div>
  );
}

function Setting({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-muted">{label}</span>
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="seg">
        {options.map((o) => (
          <button key={o} type="button" className="seg-item tabular-nums" aria-pressed={o === value} onClick={() => onChange(o)}>
            {format(o)}
          </button>
        ))}
      </div>
      <label className="pill gap-1.5" data-active={!options.includes(value)}>
        <span className="text-muted">{t("lobby.custom")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-12 bg-transparent text-center font-bold tabular-nums outline-none"
          dir="ltr"
        />
      </label>
    </div>
  );
}

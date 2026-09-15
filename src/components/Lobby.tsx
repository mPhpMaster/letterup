"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { CATEGORIES, CATEGORY_IDS, DEFAULT_CATEGORIES } from "@/lib/categories";
import { HARD_LETTERS } from "@/lib/letters";
import type { SettingsView } from "@/lib/types";
import { useGameContext } from "./GameContext";
import { Avatar, PlayerName } from "./ui";

const DURATIONS = [15, 30, 45, 60, 90];
const ROUND_COUNTS = [3, 5, 10];

export function Lobby() {
  const { state, me, isHost, hostName, participantIds, call } = useGameContext();
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
    <div className="grid animate-rise gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="card flex flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="section-title">{t("lobby.title")}</h2>
          <span className="text-sm text-muted">{t("lobby.players", { count: players.length })}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{t("lobby.invite")}</p>

        <ul className="mt-4 space-y-2">
          {players.map((p) => {
            const online = p.online || participantIds.has(p.userId);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <Avatar name={p.username} url={p.avatarUrl} dim={!online} />
                <PlayerName player={p} meId={state.me.playerId} />
                <span className="ms-auto shrink-0 text-xs font-bold">
                  {!online ? (
                    <span className="text-muted">{t("common.away")}</span>
                  ) : p.ready || p.isHost ? (
                    <span className="text-good">✓ {t("common.ready")}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto pt-5">
          {isHost ? (
            <>
              <button type="button" className="btn btn-sun w-full text-lg" disabled={settings.categories.length === 0} onClick={() => void call("start")}>
                {t("lobby.start")} →
              </button>
              <p className="mt-2 text-center text-xs text-muted">{t("lobby.readyCount", { ready: readyCount, total: players.length })}</p>
            </>
          ) : (
            <>
              <button type="button" className={`btn w-full ${me?.ready ? "btn-good" : "btn-primary"}`} onClick={() => void call("ready", { ready: !me?.ready })}>
                {me?.ready ? t("lobby.readyOn") : t("lobby.imReady")}
              </button>
              <p className="mt-2 text-center text-sm text-muted">{t("lobby.waitingHost", { name: hostName })}</p>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">{t("lobby.settings")}</h2>
        {!isHost && <p className="mt-1 text-xs text-muted">{t("lobby.hostOnly")}</p>}

        <fieldset disabled={!isHost} className="mt-4 space-y-6">
          <SettingRow label={t("lobby.roundDuration")}>
            <ChoiceChips
              options={DURATIONS}
              value={settings.roundSeconds}
              min={10}
              max={300}
              format={(v) => t("lobby.secondsShort", { value: v })}
              onChange={(roundSeconds) => update({ roundSeconds })}
            />
          </SettingRow>

          <SettingRow label={t("lobby.rounds")}>
            <ChoiceChips
              options={ROUND_COUNTS}
              value={settings.totalRounds}
              min={1}
              max={20}
              format={String}
              onChange={(totalRounds) => update({ totalRounds })}
            />
          </SettingRow>

          <SettingRow label={t("lobby.letters")}>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="chip" aria-pressed={settings.letterLocale === "en"} onClick={() => update({ letterLocale: "en" })}>
                {t("lobby.lettersEn")}
              </button>
              <button type="button" className="chip" aria-pressed={settings.letterLocale === "ar"} onClick={() => update({ letterLocale: "ar" })}>
                {t("lobby.lettersAr")}
              </button>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-brand"
                checked={settings.excludeHardLetters}
                onChange={(e) => update({ excludeHardLetters: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-semibold">{t("lobby.excludeHard")}</span>
                <span className="block text-xs text-muted">
                  {t("lobby.excludeHardHint", { letters: HARD_LETTERS[settings.letterLocale].join(locale === "ar" ? "، " : ", ") })}
                </span>
              </span>
            </label>
          </SettingRow>

          <SettingRow
            label={t("lobby.categories")}
            aside={
              <span className="flex items-center gap-1.5">
                <button type="button" className="btn btn-sm" onClick={() => update({ categories: [...CATEGORY_IDS] })}>
                  {t("lobby.selectAll")}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => update({ categories: DEFAULT_CATEGORIES })}>
                  {t("lobby.defaults")}
                </button>
              </span>
            }
          >
            <p className="mb-2 text-xs text-muted">
              {t("lobby.selected", { count: settings.categories.length, total: CATEGORIES.length })}
              {" · "}
              {t("lobby.needCategory")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c) => {
                const on = settings.categories.includes(c.id);
                return (
                  <label key={c.id} className="cat-option" data-on={on}>
                    <input type="checkbox" className="size-4 shrink-0 accent-brand" checked={on} onChange={() => toggleCategory(c.id)} />
                    <span aria-hidden>{c.emoji}</span>
                    <span className="min-w-0 truncate text-sm">{t(`categories.${c.id}`)}</span>
                  </label>
                );
              })}
            </div>
          </SettingRow>
        </fieldset>
      </section>
    </div>
  );
}

function SettingRow({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-muted uppercase tracking-wide">{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function ChoiceChips({
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
      {options.map((o) => (
        <button key={o} type="button" className="chip tabular-nums" aria-pressed={o === value} onClick={() => onChange(o)}>
          {format(o)}
        </button>
      ))}
      <label className="chip" data-active={!options.includes(value)}>
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

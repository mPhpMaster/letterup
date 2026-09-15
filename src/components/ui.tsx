"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n, type Locale } from "@/i18n/I18nProvider";
import type { PlayerView } from "@/lib/types";

function hashHue(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

export function Avatar({ name, url, size = 36, dim = false }: { name: string; url: string | null; size?: number; dim?: boolean }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, opacity: dim ? 0.45 : 1 };
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Discord CDN via URL mapping, next/image can't proxy it
      <img src={url} alt="" width={size} height={size} onError={() => setFailed(true)} className="shrink-0 rounded-full object-cover" style={style} />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ ...style, background: `hsl(${hashHue(name)} 65% 45%)`, fontSize: size * 0.42 }}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export function LetterTile({ letter, size = 72, animate = false }: { letter: string; size?: number; animate?: boolean }) {
  return (
    <span className={`letter-tile shrink-0 ${animate ? "animate-pop" : ""}`} style={{ width: size, fontSize: size * 0.58 }}>
      {letter}
    </span>
  );
}

export function TimerRing({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const { t } = useI18n();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const low = seconds <= 5 && remainingMs > 0;
  return (
    <div className={`relative size-16 shrink-0 ${low ? "animate-pulse" : ""}`} role="timer" aria-label={t("play.timeLeft", { seconds })}>
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--color-surface-2)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={low ? "var(--color-bad)" : "var(--color-sun)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 250ms linear" }}
        />
      </svg>
      <span className={`absolute inset-0 grid place-items-center text-xl font-extrabold tabular-nums ${low ? "text-bad" : ""}`}>{seconds}</span>
    </div>
  );
}

/** Two-step button: avoids window.confirm(), which Discord's sandboxed iframe blocks. */
export function ConfirmButton({ onConfirm, children, className = "btn btn-sm" }: { onConfirm: () => void; children: ReactNode; className?: string }) {
  const { t } = useI18n();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className} ${armed ? "border-bad! text-bad!" : ""}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? t("common.confirmTap") : children}
    </button>
  );
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const options: { value: Locale; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "ar", label: "عربي" },
  ];
  return (
    <div role="group" aria-label={t("header.language")} className="flex rounded-full border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          aria-pressed={locale === o.value}
          onClick={() => setLocale(o.value)}
          className={`min-h-8 rounded-full px-3 text-xs font-bold transition-colors ${locale === o.value ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PlayerName({ player, meId }: { player: PlayerView; meId: string }) {
  const { t } = useI18n();
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-semibold">{player.username}</span>
      {player.id === meId && <span className="shrink-0 text-xs text-muted">({t("common.you")})</span>}
      {player.isHost && (
        <span className="shrink-0" title={t("common.host")} aria-label={t("common.host")}>
          👑
        </span>
      )}
    </span>
  );
}

export function Spinner() {
  return <span aria-hidden className="inline-block size-8 animate-spin rounded-full border-4 border-surface-2 border-t-brand" />;
}

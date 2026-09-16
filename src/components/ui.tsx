"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { PlayerView } from "@/lib/types";
import { Icon } from "./Icon";

function hashHue(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

export function Avatar({
  name,
  url,
  size = 38,
  dim = false,
  ring,
}: {
  name: string;
  url: string | null;
  size?: number;
  dim?: boolean;
  ring?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, opacity: dim ? 0.55 : 1, border: ring };
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Discord CDN via URL mapping; next/image can't proxy it
      <img src={url} alt="" width={size} height={size} onError={() => setFailed(true)} className="shrink-0 rounded-full object-cover" style={style} />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-extrabold text-white"
      style={{ ...style, background: `oklch(68% 0.19 ${hashHue(name)})`, fontSize: size * 0.4 }}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export function LetterTile({ letter, size = 100, animate = false }: { letter: string; size?: number; animate?: boolean }) {
  return (
    <span
      className={`headline grid place-items-center text-white ${animate ? "animate-pop-letter" : ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: "var(--color-pink)",
        boxShadow: `0 ${Math.round(size * 0.08)}px 0 var(--color-pink-deep)`,
        fontSize: size * 0.5,
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
}

export function TimerRing({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const { t } = useI18n();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const circumference = 326.7; // r = 52
  const low = seconds <= 5 && remainingMs > 0;
  return (
    <svg width="112" height="112" viewBox="0 0 120 120" role="timer" aria-label={t("play.timeLeft", { seconds })} className="shrink-0">
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-line)" strokeWidth="8" />
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke={low ? "var(--color-pink)" : "var(--color-orange)"}
        strokeWidth="8"
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        style={{ transition: "stroke-dashoffset 1s linear", animation: low ? "ringPulse 0.6s ease infinite" : "none" }}
      />
      <text x="60" y="68" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--color-ink)" fontFamily="var(--font-heading)">
        {seconds}
      </text>
    </svg>
  );
}

/** Two-step button: Discord's sandboxed iframe blocks window.confirm(). */
export function ConfirmButton({ onConfirm, children, className = "btn btn-ghost btn-sm" }: { onConfirm: () => void; children: ReactNode; className?: string }) {
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
      className={className}
      style={armed ? { borderColor: "var(--color-pink)", color: "var(--color-pink)" } : undefined}
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
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      aria-label={t("header.language")}
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
    >
      <Icon name="globe" size={16} />
      <span lang={locale === "en" ? "ar" : "en"}>{locale === "en" ? "العربية" : "English"}</span>
    </button>
  );
}

export function PlayerName({ player, meId, onClick }: { player: PlayerView; meId: string; onClick?: () => void }) {
  const { t } = useI18n();
  const content = (
    <>
      <span className="truncate font-semibold">{player.username}</span>
      {player.id === meId && <span className="shrink-0 text-xs text-muted">({t("common.you")})</span>}
      {player.isHost && <Icon name="crown" size={15} className="shrink-0 text-amber" />}
    </>
  );
  if (!onClick) return <span className="flex min-w-0 items-center gap-1.5">{content}</span>;
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-1.5 text-start hover:underline">
      {content}
    </button>
  );
}

export function Spinner({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block animate-spin rounded-full"
      style={{ width: size, height: size, border: "4px solid var(--color-line)", borderTopColor: "var(--color-orange)" }}
    />
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return <div className="text-center text-xs font-bold text-mint">{children}</div>;
}

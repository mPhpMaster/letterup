"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryEmoji, categoryTone, TONES, toneBg, toneSolid } from "@/lib/categories";
import { useSound } from "@/lib/sound";
import type { PlayerView } from "@/lib/types";
import { Icon } from "./Icon";

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) % 9973;
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
  // No picture: a party-palette disc with the initial, stable per name.
  const tone = TONES[hash(name) % TONES.length];
  return (
    <span
      aria-hidden
      className={`headline grid shrink-0 place-items-center rounded-full ${toneSolid[tone]}`}
      style={{ ...style, fontSize: size * 0.42 }}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** The round's letter on a yellow sticker. */
export function LetterTile({ letter, size = 100, animate = false }: { letter: string; size?: number; animate?: boolean }) {
  // Capped in viewport units so the tile shrinks on Discord's narrow mobile panel.
  const box = `min(${size}px, ${Math.round(size / 3.6)}vw)`;
  return (
    <span
      key={animate ? letter : undefined}
      className={`headline grid shrink-0 place-items-center bg-accent text-ink ${animate ? "animate-pop-letter" : ""}`}
      style={{
        width: box,
        height: box,
        borderRadius: `calc(${box} * 0.27)`,
        boxShadow: `0 calc(${box} * 0.08) 0 var(--color-accent-deep)`,
        fontSize: `calc(${box} * 0.6)`,
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
}

/** Emoji on a tinted tile, one colour per category. */
export function CategoryTile({ id, size = 40 }: { id: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-xl ${toneBg[categoryTone(id)]}`}
      style={{ width: size, height: size, fontSize: size * 0.5, borderRadius: size * 0.3 }}
    >
      {categoryEmoji(id)}
    </span>
  );
}

/** Conic countdown ring around an ink disc; shakes and turns red for the last five seconds. */
export function TimerRing({ remainingMs, totalMs, size = 64 }: { remainingMs: number; totalMs: number; size?: number }) {
  const { t } = useI18n();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const urgent = seconds <= 5 && remainingMs > 0;
  const inner = Math.round(size * 0.78);
  return (
    <div
      role="timer"
      aria-label={t("play.timeLeft", { seconds })}
      className={`grid shrink-0 place-items-center rounded-full ${urgent ? "animate-tick-shake" : ""}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${urgent ? "var(--color-brand)" : "var(--color-mint)"} ${fraction * 360}deg, var(--color-edge) 0deg)`,
      }}
    >
      <span
        className="headline grid place-items-center rounded-full bg-ink text-cream tabular-nums"
        style={{ width: inner, height: inner, fontSize: inner * 0.44 }}
      >
        {seconds}
      </span>
    </div>
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
      style={armed ? { background: "var(--color-brand)", color: "#fff" } : undefined}
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
      className="tool flex items-center gap-1.5 bg-ink px-3 text-cream"
      aria-label={t("header.language")}
      title={t("header.language")}
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
    >
      <span aria-hidden className="text-base leading-none">
        🌍
      </span>
      <span lang={locale === "en" ? "ar" : "en"}>{locale === "en" ? "ع" : "EN"}</span>
    </button>
  );
}

export function SoundToggle() {
  const { enabled, toggle } = useSound();
  const { t } = useI18n();
  const label = enabled ? t("header.soundOn") : t("header.soundOff");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      className={`tool text-lg ${enabled ? "bg-mint/20" : "text-ink/40"}`}
    >
      <span aria-hidden>{enabled ? "🔊" : "🔇"}</span>
    </button>
  );
}

/**
 * The persistent header card: logo, a line under the name (round or tagline), and
 * whatever tools the screen needs, always ending with sound and language.
 */
export function AppHeader({
  subtitle,
  badge,
  onLogoClick,
  logoLabel,
  children,
}: {
  subtitle?: string;
  badge?: string;
  onLogoClick?: () => void;
  logoLabel?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const brand = (
    <>
      <span className="headline grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-xl text-white shadow-[0_3px_0_var(--color-brand-deep)] sm:size-11">
        L
      </span>
      {/* Phones need the room for the tools; the logo alone still reads as the brand. */}
      <span className="hidden min-w-0 leading-none min-[420px]:block">
        <span className="headline block truncate text-lg sm:text-xl">{t("app.short")}</span>
        <span className="mt-0.5 block truncate text-[10px] font-extrabold tracking-widest text-brand uppercase rtl:tracking-normal">
          {subtitle ?? t("app.title")}
        </span>
      </span>
    </>
  );
  return (
    <header className="card-pop-sm flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5">
      {onLogoClick ? (
        <button type="button" className="me-auto flex min-w-0 items-center gap-2.5 text-start" onClick={onLogoClick} aria-label={logoLabel}>
          {brand}
        </button>
      ) : (
        <div className="me-auto flex min-w-0 items-center gap-2.5">{brand}</div>
      )}
      {badge && (
        <span className="headline hidden shrink-0 rounded-full bg-grape/10 px-4 py-2 text-sm text-grape md:block">{badge}</span>
      )}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {children}
        <SoundToggle />
        <LanguageToggle />
      </div>
    </header>
  );
}

export function PlayerName({ player, meId, onClick }: { player: PlayerView; meId: string; onClick?: () => void }) {
  const { t } = useI18n();
  const content = (
    <>
      <span className="truncate font-extrabold">{player.username}</span>
      {player.id === meId && <span className="shrink-0 text-xs font-bold text-muted">({t("common.you")})</span>}
      {player.isHost && <Icon name="crown" size={15} className="shrink-0 text-accent-deep" filled />}
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
      style={{ width: size, height: size, border: `${Math.max(3, size / 8)}px solid var(--color-edge)`, borderTopColor: "var(--color-brand)" }}
    />
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return <div className="text-center text-xs font-extrabold text-mint-deep">{children}</div>;
}

const CONFETTI_COLORS = ["var(--color-brand)", "var(--color-accent)", "var(--color-mint)", "var(--color-grape)", "var(--color-sky)"];

export function Confetti({ count = 40 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            insetInlineStart: `${(i * 97) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 12) * 0.28}s`,
            animationDuration: `${2.8 + ((i * 7) % 18) / 10}s`,
          }}
        />
      ))}
    </div>
  );
}

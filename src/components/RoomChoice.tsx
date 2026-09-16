"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { RoomSummary, SessionUser } from "@/lib/types";
import { Icon } from "./Icon";
import { RoomList } from "./RoomList";
import { AppHeader, Avatar, Spinner } from "./ui";

const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

/** Home screen: open rooms, create or join, plus leaderboard, suggestions and (for admins) the panel. */
export function RoomChoice({
  user,
  token,
  isAdmin,
  onCreate,
  onJoin,
  onJoinRoom,
  onOpenLeaderboard,
  onOpenSuggest,
  onOpenAdmin,
  onOpenProfile,
  onSignOut,
  busy,
  error,
  initialCode = "",
  children,
}: {
  user: SessionUser;
  token: string | null;
  isAdmin: boolean;
  onCreate: (password?: string) => void;
  onJoin: (code: string) => void;
  onJoinRoom: (room: RoomSummary) => void;
  onOpenLeaderboard: () => void;
  onOpenSuggest: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: (userId: string) => void;
  onSignOut: () => void;
  busy: boolean;
  error?: string | null;
  initialCode?: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState(sanitize(initialCode));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length >= 4 && !busy) onJoin(code);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-3 pb-8 sm:gap-5 sm:p-5">
      <AppHeader subtitle={t("app.title")}>
        <button type="button" className="tool" onClick={onOpenLeaderboard} aria-label={t("leaderboard.open")} title={t("leaderboard.open")}>
          <Icon name="crown" size={19} />
        </button>
        {isAdmin && (
          <button type="button" className="tool" onClick={onOpenAdmin} aria-label={t("admin.open")} title={t("admin.open")}>
            <Icon name="sealCheck" size={19} />
          </button>
        )}
      </AppHeader>

      <main className="grid flex-1 items-start gap-4 sm:gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4 sm:gap-5">
          <section className="card-pop animate-rise flex flex-col gap-4">
            {/* Your own name opens your card here too -- every other name in the app does. */}
            <button
              type="button"
              className="flex min-w-0 items-center gap-3 self-start rounded-full bg-cream py-1.5 ps-1.5 pe-4 text-start outline-1 outline-ink/10 transition-transform active:scale-95"
              onClick={() => onOpenProfile(user.userId)}
            >
              <Avatar name={user.username} url={user.avatarUrl} size={34} />
              <span className="min-w-0 truncate text-sm font-extrabold">{t("room.signedInAs", { name: user.username })}</span>
            </button>

            <h1 className="headline text-3xl">{t("room.title")} 🎈</h1>

            {children}

            <div className="flex flex-col gap-2">
              <button type="button" className="btn btn-brand w-full py-4 text-xl" onClick={() => onCreate(password || undefined)} disabled={busy}>
                <Icon name="plusCircle" size={22} />
                {busy ? t("room.creating") : t("room.createCta")}
              </button>

              {showPassword ? (
                <input
                  className="input mt-1"
                  type="password"
                  dir="auto"
                  maxLength={64}
                  placeholder={t("rooms.setPasswordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              ) : (
                <button type="button" className="mt-1 text-xs font-bold text-muted hover:underline" onClick={() => setShowPassword(true)}>
                  🔒 {t("rooms.setPassword")}
                </button>
              )}
            </div>

            <div className="kicker flex items-center gap-3">
              <span className="h-0.5 flex-1 rounded-full bg-edge" />
              {t("room.or")}
              <span className="h-0.5 flex-1 rounded-full bg-edge" />
            </div>

            <form onSubmit={submit} className="flex gap-2">
              <input
                className="input headline flex-1 text-center text-lg tracking-[0.3em] text-brand uppercase placeholder:tracking-normal"
                dir="ltr"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                placeholder={t("room.joinPlaceholder")}
                value={code}
                onChange={(e) => setCode(sanitize(e.target.value))}
              />
              <button type="submit" className="btn btn-ink px-6" disabled={busy || code.length < 4}>
                {t("room.joinCta")}
              </button>
            </form>

            {busy && (
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted">
                <Spinner size={18} /> {t("room.joining")}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-2xl bg-brand/10 px-3 py-2 text-center text-sm font-bold text-brand" dir="auto">
                {error}
              </p>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-accent btn-sm flex-1" onClick={onOpenLeaderboard}>
              <Icon name="crown" size={16} />
              {t("leaderboard.open")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={onOpenSuggest}>
              <Icon name="share" size={16} />
              {t("suggest.open")}
            </button>
          </div>

          <button type="button" className="self-center text-xs font-bold text-muted hover:underline" onClick={onSignOut}>
            <Icon name="signOut" size={13} className="me-1 inline rtl:-scale-x-100" />
            {t("room.signOut")}
          </button>
        </div>

        <RoomList token={token} onJoin={onJoinRoom} />
      </main>
    </div>
  );
}

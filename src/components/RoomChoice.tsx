"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { RoomSummary, SessionUser } from "@/lib/types";
import { Icon } from "./Icon";
import { RoomList } from "./RoomList";
import { Avatar, LanguageToggle, Spinner } from "./ui";

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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <header className="flex items-center gap-2 py-3">
        {/* Your own name opens your card here too -- every other name in the app does. */}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-start" onClick={() => onOpenProfile(user.userId)}>
          <Avatar name={user.username} url={user.avatarUrl} size={32} />
          <span className="min-w-0 flex-1 truncate text-sm text-muted hover:underline">{t("room.signedInAs", { name: user.username })}</span>
        </button>
        {isAdmin && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenAdmin}>
            <Icon name="sealCheck" size={15} />
            {t("admin.open")}
          </button>
        )}
        <LanguageToggle />
      </header>

      <main className="flex flex-1 flex-col gap-4 pb-10">
        <h1 className="headline text-center text-[26px]">{t("room.title")}</h1>

        {children}

        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary text-base" onClick={() => onCreate(password || undefined)} disabled={busy}>
            <Icon name="plusCircle" size={20} />
            {busy ? t("room.creating") : t("room.createCta")}
          </button>

          {showPassword ? (
            <input
              className="input"
              type="password"
              dir="auto"
              maxLength={64}
              placeholder={t("rooms.setPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : (
            <button type="button" className="text-[12px] font-semibold text-muted hover:underline" onClick={() => setShowPassword(true)}>
              🔒 {t("rooms.setPassword")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-xs font-bold text-sand">
          <span className="h-0.5 flex-1 bg-line" />
          {t("room.or")}
          <span className="h-0.5 flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <input
            className="input flex-1 text-center font-mono tracking-[0.3em] uppercase"
            dir="ltr"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            placeholder={t("room.joinPlaceholder")}
            value={code}
            onChange={(e) => setCode(sanitize(e.target.value))}
          />
          <button type="submit" className="btn btn-outline" disabled={busy || code.length < 4}>
            {t("room.joinCta")}
          </button>
        </form>

        {busy && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner size={18} /> {t("room.joining")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-sm font-semibold text-pink" dir="auto">
            {error}
          </p>
        )}

        <RoomList token={token} onJoin={onJoinRoom} />

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={onOpenLeaderboard}>
            <Icon name="crown" size={15} />
            {t("leaderboard.open")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={onOpenSuggest}>
            <Icon name="share" size={15} />
            {t("suggest.open")}
          </button>
        </div>

        <button type="button" className="self-center text-[12px] font-semibold text-muted hover:underline" onClick={onSignOut}>
          <Icon name="signOut" size={13} className="me-1 inline" />
          {t("room.signOut")}
        </button>
      </main>
    </div>
  );
}

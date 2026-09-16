"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { SessionUser } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, LanguageToggle, Spinner } from "./ui";

const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

/** After signing in: start a new room or join one with a code. */
export function RoomChoice({
  user,
  onCreate,
  onJoin,
  busy,
  error,
  initialCode = "",
  children,
}: {
  user: SessionUser;
  onCreate: () => void;
  onJoin: (code: string) => void;
  busy: boolean;
  error?: string | null;
  initialCode?: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState(sanitize(initialCode));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length >= 4 && !busy) onJoin(code);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <header className="flex items-center gap-2 py-3">
        <Avatar name={user.username} url={user.avatarUrl} size={32} />
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{t("room.signedInAs", { name: user.username })}</span>
        <LanguageToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 pb-12">
        <h1 className="headline text-center text-[26px]">{t("room.title")}</h1>

        {children}

        <button type="button" className="btn btn-primary text-base" onClick={onCreate} disabled={busy}>
          <Icon name="plusCircle" size={20} />
          {busy ? t("room.creating") : t("room.createCta")}
        </button>

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
      </main>
    </div>
  );
}

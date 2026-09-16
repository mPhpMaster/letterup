"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { Icon } from "./Icon";
import { LanguageToggle } from "./ui";

/** Browser entry point: everyone signs in with Discord before they can create or join a room. */
export function Login({ error, next = "/" }: { error?: string | null; next?: string }) {
  const { t } = useI18n();
  const href = `/api/auth/discord/start?next=${encodeURIComponent(next)}`;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-end p-4">
        <LanguageToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 text-center">
        <span className="headline grid place-items-center rounded-[22px] bg-orange text-[34px] text-white" style={{ width: 72, height: 72 }}>
          L
        </span>
        <div>
          <h1 className="headline text-[26px]">{t("login.title")}</h1>
          <p className="mx-auto mt-2 max-w-[280px] text-sm text-muted">{t("login.subtitle")}</p>
        </div>
        <a href={href} className="btn btn-discord text-base">
          <Icon name="discord" size={20} />
          {t("login.continueDiscord")}
        </a>
        {error && (
          <p role="alert" className="text-sm font-semibold text-pink">
            {t("login.failed")}
          </p>
        )}
      </main>
    </div>
  );
}

"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { CATEGORIES } from "@/lib/categories";
import { Icon } from "./Icon";
import { AppHeader } from "./ui";

/** Browser entry point: everyone signs in with Discord before they can create or join a room. */
export function Login({ error, next = "/" }: { error?: string | null; next?: string }) {
  const { t } = useI18n();
  const href = `/api/auth/discord/start?next=${encodeURIComponent(next)}`;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-3 sm:gap-5 sm:p-5">
      <AppHeader subtitle={t("app.title")} />
      <main className="flex flex-1 flex-col items-center justify-center pb-10">
        <section className="card-pop animate-rise flex w-full max-w-md flex-col items-center gap-6 text-center">
          <span className="headline animate-pop-letter grid size-24 place-items-center rounded-[30px] bg-accent text-6xl text-ink shadow-[0_10px_0_var(--color-accent-deep)]">
            L
          </span>
          <div>
            <h1 className="headline text-3xl">{t("login.title")}</h1>
            <p className="mx-auto mt-2 max-w-[300px] text-sm font-semibold text-muted">{t("login.subtitle")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2" aria-hidden>
            {CATEGORIES.slice(0, 6).map((c, i) => (
              <span
                key={c.id}
                className="animate-score-pop grid size-10 place-items-center rounded-2xl bg-cream text-xl"
                style={{ animationDelay: `${150 + i * 70}ms` }}
              >
                {c.emoji}
              </span>
            ))}
          </div>
          <a href={href} className="btn btn-discord w-full py-4 text-lg">
            <Icon name="discord" size={22} />
            {t("login.continueDiscord")}
          </a>
          {error && (
            <p role="alert" className="rounded-2xl bg-brand/10 px-3 py-2 text-sm font-bold text-brand">
              {t("login.failed")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

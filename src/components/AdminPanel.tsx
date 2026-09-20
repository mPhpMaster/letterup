"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { postJson } from "@/lib/api";
import type { AdminState } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, ModalShell, Spinner } from "./ui";

type Tab = "suggestions" | "reports" | "banned";

/** Admin-only: read suggestions and reports, ban or unban players. */
export function AdminPanel({ token, onClose }: { token: string | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("reports");
  const [state, setState] = useState<AdminState | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      setState(await postJson<AdminState>(`/api/admin/${action}`, body, token ?? undefined));
    } catch {
      // leave the current view in place; the action simply didn't apply
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void call("state");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the panel opens
  }, []);

  const date = (ms: number) => new Date(ms).toLocaleString(locale === "ar" ? "ar" : "en-GB", { dateStyle: "short", timeStyle: "short" });
  const tabs: Tab[] = ["reports", "suggestions", "banned"];
  const counts = {
    reports: state?.reports.filter((r) => !r.handled).length ?? 0,
    suggestions: state?.suggestions.filter((s) => !s.handled).length ?? 0,
    banned: state?.banned.length ?? 0,
  };

  return (
    <ModalShell label={t("admin.title")} onClose={onClose} className="max-w-[460px]">
        <div className="flex items-center gap-2">
          <h3 className="headline flex-1 text-xl">{t("admin.title")}</h3>
          {busy && <Spinner size={16} />}
          <button
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform active:scale-90"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="seg">
          {tabs.map((id) => (
            <button key={id} type="button" className="seg-item" aria-pressed={tab === id} onClick={() => setTab(id)}>
              {t(`admin.${id}`)}
              {counts[id] > 0 && <span className="ms-1 text-[11px]">({counts[id]})</span>}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {!state && <Spinner />}

          {state && tab === "reports" && state.reports.length === 0 && <p className="text-sm text-muted">{t("admin.none")}</p>}
          {state &&
            tab === "reports" &&
            state.reports.map((r) => (
              <div key={r.id} className="rounded-2xl bg-cream p-2.5" style={{ opacity: r.handled ? 0.55 : 1 }}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{r.reportedName}</span>
                  <span className="text-[10px] text-sand">{date(r.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm break-words" dir="auto">
                  {r.reason}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">{t("admin.reportedBy", { name: r.reporterName })}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => void call("ban", { userId: r.reportedUserId, reason: r.reason })}>
                    {t("admin.ban")}
                  </button>
                  {!r.handled && (
                    <button type="button" className="btn btn-sm btn-mint" onClick={() => void call("handle", { table: "reports", id: r.id })}>
                      {t("admin.markHandled")}
                    </button>
                  )}
                  {r.handled && <span className="pill text-[11px] text-mint">{t("admin.handled")}</span>}
                </div>
              </div>
            ))}

          {state && tab === "suggestions" && state.suggestions.length === 0 && <p className="text-sm text-muted">{t("admin.none")}</p>}
          {state &&
            tab === "suggestions" &&
            state.suggestions.map((s) => (
              <div key={s.id} className="rounded-2xl bg-cream p-2.5" style={{ opacity: s.handled ? 0.55 : 1 }}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.username}</span>
                  <span className="text-[10px] text-sand">{date(s.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm break-words" dir="auto">
                  {s.body}
                </p>
                {!s.handled ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-mint mt-2"
                    onClick={() => void call("handle", { table: "suggestions", id: s.id })}
                  >
                    {t("admin.markHandled")}
                  </button>
                ) : (
                  <span className="pill mt-2 text-[11px] text-mint">{t("admin.handled")}</span>
                )}
              </div>
            ))}

          {state && tab === "banned" && state.banned.length === 0 && <p className="text-sm text-muted">{t("admin.none")}</p>}
          {state &&
            tab === "banned" &&
            state.banned.map((b) => (
              <div key={b.userId} className="flex items-center gap-2.5 rounded-2xl bg-cream p-2.5">
                <Avatar name={b.username} url={b.avatarUrl} size={30} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{b.username}</span>
                  <span className="block text-[11px] text-muted">{t("admin.bannedSince", { date: date(b.bannedAt) })}</span>
                  {b.reason && (
                    <span className="block truncate text-[11px] text-sand" dir="auto">
                      {b.reason}
                    </span>
                  )}
                </div>
                <button type="button" className="btn btn-sm btn-orange" onClick={() => void call("unban", { userId: b.userId })}>
                  {t("admin.unban")}
                </button>
              </div>
            ))}
        </div>
    </ModalShell>
  );
}

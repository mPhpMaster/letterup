"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { postJson } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, Spinner } from "./ui";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Global ranking, open from the home screen or the in-game header. */
export function Leaderboard({
  token,
  myUserId,
  onClose,
  onOpenProfile,
  onReport,
}: {
  token: string | null;
  myUserId: string | null;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onReport: (userId: string, username: string) => void;
}) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    postJson<{ entries: LeaderboardEntry[] }>("/api/social/leaderboard", {}, token ?? undefined)
      .then((res) => active && setEntries(res.entries))
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card max-w-[420px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("leaderboard.title")}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h3 className="headline text-[19px]">{t("leaderboard.title")} 🏆</h3>
            <p className="text-[11px] text-muted">{t("leaderboard.subtitle")}</p>
          </div>
          <button
            type="button"
            className="btn btn-icon"
            style={{ background: "var(--color-line-soft)", color: "var(--color-pink)" }}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {!entries ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("leaderboard.empty")}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {entries.map((e) => {
              const isMe = e.userId === myUserId;
              return (
                <div
                  key={e.userId}
                  className="flex items-center gap-2.5 rounded-[14px] px-2.5 py-2"
                  style={{
                    background: isMe ? "var(--color-line-soft)" : "var(--color-cream)",
                    border: isMe ? "2px solid var(--color-orange)" : "2px solid transparent",
                  }}
                >
                  <span className="headline w-7 shrink-0 text-center text-[15px] text-sand">{MEDAL[e.rank] ?? e.rank}</span>
                  <Avatar name={e.username} url={e.avatarUrl} size={30} />
                  <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onOpenProfile(e.userId)}>
                    <span className="block truncate text-sm font-semibold">
                      {e.username}
                      {isMe && <span className="ms-1 text-[11px] text-muted">({t("leaderboard.you")})</span>}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {t("leaderboard.wins")}: {e.wins} · {t("leaderboard.games")}: {e.gamesPlayed}
                    </span>
                  </button>
                  <span className="headline shrink-0 text-[15px] text-orange tabular-nums">{e.totalPoints}</span>
                  {!isMe && (
                    <button
                      type="button"
                      className="btn btn-icon"
                      style={{ background: "transparent", color: "var(--color-sand)" }}
                      title={t("report.open")}
                      aria-label={t("report.open")}
                      onClick={() => onReport(e.userId, e.username)}
                    >
                      <Icon name="flag" size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

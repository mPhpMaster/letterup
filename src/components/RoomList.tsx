"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { postJson } from "@/lib/api";
import type { RoomSummary } from "@/lib/types";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

const REFRESH_MS = 15_000;

/** Open rooms on the home screen, with live status and a lock for protected ones. */
export function RoomList({ token, onJoin }: { token: string | null; onJoin: (room: RoomSummary) => void }) {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await postJson<{ rooms: RoomSummary[] }>("/api/social/rooms", {}, token ?? undefined);
      setRooms(res.rooms);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const statusLabel = (room: RoomSummary) => {
    if (room.status === "lobby") return t("rooms.waiting");
    if (room.status === "voting") return t("rooms.voting");
    if (room.status === "results") return t("rooms.results");
    return t("rooms.playing", { current: room.currentRound, total: room.totalRounds });
  };

  return (
    <section className="card-pop animate-rise flex flex-col gap-3" style={{ animationDelay: "80ms" }}>
      <div className="flex items-center gap-2">
        <h2 className="headline flex-1 text-xl">{t("rooms.title")}</h2>
        <button type="button" className="seg-item flex items-center gap-1.5 px-3! py-1.5! text-xs!" onClick={() => void load()} disabled={loading}>
          <Icon name="replay" size={14} className={loading ? "animate-spin" : ""} />
          {t("rooms.refresh")}
        </button>
      </div>

      {!rooms && (
        <div className="grid place-items-center py-6">
          <Spinner size={26} />
        </div>
      )}
      {rooms?.length === 0 && (
        <div className="rounded-3xl bg-cream px-4 py-8 text-center">
          <p className="text-3xl" aria-hidden>
            🎲
          </p>
          <p className="mt-2 text-sm font-bold text-muted">{t("rooms.empty")}</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {rooms?.map((room, i) => (
          <li
            key={room.roomCode}
            className="animate-rise flex items-center gap-3 rounded-2xl bg-cream p-3 outline-1 outline-ink/5"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className={`size-2.5 shrink-0 rounded-full ${room.status === "lobby" ? "bg-mint" : "bg-accent"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="headline text-base tracking-[0.15em] text-brand" dir="ltr">
                  {room.roomCode}
                </span>
                {room.hasPassword && (
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-extrabold text-ink/50" title={t("rooms.locked")}>
                    🔒 {t("rooms.locked")}
                  </span>
                )}
              </div>
              <div className="truncate text-xs font-semibold text-muted">
                {statusLabel(room)} · {t("rooms.players", { count: room.playerCount })}
                {room.hostUsername ? ` · ${t("rooms.hostedBy", { name: room.hostUsername })}` : ""}
              </div>
            </div>
            <button type="button" className="btn btn-mint btn-sm shrink-0" onClick={() => onJoin(room)}>
              {t("rooms.join")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

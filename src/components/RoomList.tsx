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
    <section className="card flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="headline flex-1 text-base">{t("rooms.title")}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          <Icon name="replay" size={14} />
          {t("rooms.refresh")}
        </button>
      </div>

      {!rooms && (
        <div className="grid place-items-center py-4">
          <Spinner size={22} />
        </div>
      )}
      {rooms?.length === 0 && <p className="py-2 text-sm text-muted">{t("rooms.empty")}</p>}

      {rooms?.map((room) => (
        <div key={room.roomCode} className="flex items-center gap-2.5 rounded-[14px] bg-cream p-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold tracking-[0.12em] text-orange" dir="ltr">
                {room.roomCode}
              </span>
              {room.hasPassword && (
                <span className="pill gap-1 px-2 py-0.5 text-[10px] text-sand" title={t("rooms.locked")}>
                  <Icon name="link" size={11} />
                  {t("rooms.locked")}
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-muted">
              {statusLabel(room)} · {t("rooms.players", { count: room.playerCount })}
              {room.hostUsername ? ` · ${t("rooms.hostedBy", { name: room.hostUsername })}` : ""}
            </div>
          </div>
          <button type="button" className="btn btn-mint btn-sm" onClick={() => onJoin(room)}>
            {t("rooms.join")}
          </button>
        </div>
      ))}
    </section>
  );
}

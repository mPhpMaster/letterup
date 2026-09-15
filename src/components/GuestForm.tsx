"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { postJson } from "@/lib/api";
import type { GameState, SessionUser } from "@/lib/types";

const NAME_KEY = "hapo.guestName";
const ID_KEY = "hapo.guestId"; // sessionStorage: one identity per tab, so several tabs can play together

const sanitizeRoom = (value: string) => value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}
function safeSet(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // ignore
  }
}

export function GuestForm({ onJoined }: { onJoined: (token: string, state: GameState) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(safeGet(() => localStorage, NAME_KEY) ?? "");
    const fromUrl = sanitizeRoom(new URLSearchParams(window.location.search).get("room") ?? "");
    setRoom(fromUrl || Math.random().toString(36).slice(2, 7).toUpperCase());
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const roomCode = sanitizeRoom(room);
    if (!name.trim() || !roomCode) return;
    setBusy(true);
    setError(null);
    try {
      const auth = await postJson<{ token: string; user: SessionUser }>("/api/auth/guest", {
        name: name.trim(),
        guestId: safeGet(() => sessionStorage, ID_KEY),
      });
      safeSet(() => localStorage, NAME_KEY, name.trim());
      safeSet(() => sessionStorage, ID_KEY, auth.user.userId);
      const url = new URL(window.location.href);
      url.searchParams.set("room", roomCode);
      window.history.replaceState(null, "", url);
      const state = await postJson<GameState>("/api/game/join", { instanceId: roomCode }, auth.token);
      onJoined(auth.token, state);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card w-full space-y-4 text-start">
      <div>
        <h2 className="section-title">{t("guest.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("guest.subtitle")}</p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{t("guest.name")}</span>
        <input className="input" dir="auto" maxLength={32} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{t("guest.room")}</span>
        <input className="input font-mono tracking-widest" dir="ltr" required value={room} onChange={(e) => setRoom(sanitizeRoom(e.target.value))} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-bad" dir="auto">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || !name.trim() || !room}>
        {busy ? t("guest.joining") : t("guest.join")}
      </button>
    </form>
  );
}

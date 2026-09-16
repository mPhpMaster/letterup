"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { postJson } from "@/lib/api";
import type { SearchResultView, SocialState } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, Spinner, Toast } from "./ui";

/** Friends list: follow/unfollow, invite into the current room, or jump into theirs. */
export function FriendsDrawer({
  social,
  token,
  canInvite,
  roomUserIds,
  onClose,
  onFollow,
  onInvite,
  onJoinRoom,
  onOpenProfile,
}: {
  social: SocialState;
  token: string | null;
  canInvite: boolean;
  /** Everyone already in the viewer's room — they can't be invited to it again. */
  roomUserIds: ReadonlySet<string>;
  onClose: () => void;
  onFollow: (userId: string, follow: boolean) => void;
  onInvite: (userId: string) => void;
  onJoinRoom: (code: string) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultView[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      const res = await postJson<{ results: SearchResultView[] }>("/api/social/search", { query }, token ?? undefined);
      setResults(res.results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card max-w-[380px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("friends.title")}>
        <div className="flex items-center gap-2">
          <h3 className="headline flex-1 text-xl">{t("friends.title")}</h3>
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform active:scale-90" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={search} className="flex gap-2">
          <input
            className="input flex-1"
            dir="auto"
            placeholder={t("friends.searchPlaceholder")}
            value={query}
            maxLength={64}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-orange btn-sm px-4" disabled={searching || query.trim().length < 3}>
            {searching ? t("friends.searching") : t("friends.searchCta")}
          </button>
        </form>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {results && (
            <>
              {results.length === 0 && <p className="px-1 text-sm text-muted">{t("friends.noResults")}</p>}
              {results.map((r) => (
                <Row
                  key={r.userId}
                  name={r.username}
                  avatarUrl={r.avatarUrl}
                  online={r.online}
                  onOpen={() => onOpenProfile(r.userId)}
                  right={
                    <button
                      type="button"
                      className={`btn btn-sm ${r.isFollowing ? "btn-ghost" : "btn-orange"}`}
                      onClick={() => {
                        onFollow(r.userId, !r.isFollowing);
                        setResults((prev) => prev?.map((x) => (x.userId === r.userId ? { ...x, isFollowing: !r.isFollowing } : x)) ?? null);
                      }}
                    >
                      <Icon name={r.isFollowing ? "userCheck" : "userPlus"} size={15} />
                      {r.isFollowing ? t("friends.following") : t("friends.follow")}
                    </button>
                  }
                />
              ))}
              <hr className="border-line" />
            </>
          )}

          {social.friends.length === 0 && !results && <p className="px-1 text-sm text-muted">{t("friends.empty")}</p>}

          {social.friends.map((f) => (
            <Row
              key={f.userId}
              name={f.username}
              avatarUrl={f.avatarUrl}
              online={f.online}
              subtitle={f.currentRoomCode ? t("friends.inGame") : f.online ? t("friends.online") : t("friends.offline")}
              onOpen={() => onOpenProfile(f.userId)}
              right={
                <span className="flex items-center gap-1">
                  {roomUserIds.has(f.userId) ? (
                    <span className="pill text-[11px] text-sand">{t("friends.inYourRoom")}</span>
                  ) : f.currentRoomCode ? (
                    <button type="button" className="btn btn-mint btn-sm" onClick={() => onJoinRoom(f.currentRoomCode!)}>
                      {t("friends.join")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-sm ${f.invited ? "btn-ghost" : "btn-orange"}`}
                      disabled={!canInvite || f.invited}
                      title={canInvite ? undefined : t("friends.inviteNeedsRoom")}
                      onClick={() => {
                        onInvite(f.userId);
                        flash(t("friends.inviteSent"));
                      }}
                    >
                      {f.invited ? t("friends.invited") : t("friends.invite")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink/5 text-ink/45 transition-transform active:scale-90"
                    title={t("friends.remove")}
                    aria-label={t("friends.remove")}
                    onClick={() => onFollow(f.userId, false)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </span>
              }
            />
          ))}
        </div>

        {searching && <Spinner size={18} />}
        {toast && <Toast>{toast}</Toast>}
      </div>
    </div>
  );
}

function Row({
  name,
  avatarUrl,
  online,
  subtitle,
  right,
  onOpen,
}: {
  name: string;
  avatarUrl: string | null;
  online: boolean;
  subtitle?: string;
  right: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-cream p-2">
      <span className="relative shrink-0">
        <Avatar name={name} url={avatarUrl} size={32} dim={!online} />
        {online && <span className="absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-cream bg-mint" />}
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-semibold">{name}</span>
        {subtitle && <span className="block text-[11px] text-muted">{subtitle}</span>}
      </button>
      {right}
    </div>
  );
}

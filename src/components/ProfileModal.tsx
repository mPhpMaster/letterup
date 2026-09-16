"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { ProfileView } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, Spinner } from "./ui";

/** Tap a player anywhere in the game to see their lifetime stats, follow, or report them. */
export function ProfileModal({
  profile,
  loading,
  myRoomCode = null,
  isAdmin = false,
  onClose,
  onToggleFollow,
  onJoinRoom,
  onReport,
  onBan,
  onUnban,
}: {
  profile: ProfileView | null;
  loading: boolean;
  /** Room the viewer is in, so we don't offer to join a room they're already in. */
  myRoomCode?: string | null;
  isAdmin?: boolean;
  onClose: () => void;
  onToggleFollow: (userId: string, follow: boolean) => void;
  onJoinRoom: (code: string) => void;
  onReport: (userId: string, username: string) => void;
  onBan?: (userId: string, username: string) => void;
  onUnban?: (userId: string) => void;
}) {
  const { t } = useI18n();
  const canJoinTheirRoom = !!profile?.currentRoomCode && profile.currentRoomCode !== myRoomCode;

  const stats = profile
    ? [
        { label: t("profile.gamesPlayed"), value: profile.gamesPlayed },
        { label: t("profile.wins"), value: profile.wins },
        { label: t("profile.winRate"), value: `${profile.winRate}%` },
        { label: t("profile.roundsPlayed"), value: profile.roundsPlayed },
        { label: t("profile.avgPerRound"), value: profile.averagePerRound },
        { label: t("profile.avgPerGame"), value: profile.averagePerGame },
        { label: t("profile.totalPoints"), value: profile.totalPoints },
        { label: t("profile.bestScore"), value: profile.bestScore },
        { label: t("profile.followers"), value: profile.followers },
        { label: t("profile.followingCount"), value: profile.following },
      ]
    : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card max-w-[360px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("header.profile")}>
        {loading || !profile ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={profile.username} url={profile.avatarUrl} size={56} />
              <div className="min-w-0 flex-1">
                <div className="headline truncate text-[19px]">{profile.username}</div>
                <div className="text-xs font-semibold text-muted">{profile.online ? t("friends.online") : t("friends.offline")}</div>
              </div>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform active:scale-90"
                onClick={onClose}
                aria-label={t("common.close")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {profile.isBanned && (
              <p className="rounded-[12px] bg-pink/10 px-3 py-2 text-sm font-semibold text-pink" dir="auto">
                {t("profile.banned")}
                {profile.banReason ? ` — ${profile.banReason}` : ""}
              </p>
            )}

            {profile.gamesPlayed === 0 ? (
              <p className="text-sm text-muted">{t("profile.noStats")}</p>
            ) : (
              <div className="grid max-h-[40dvh] grid-cols-2 gap-2 overflow-y-auto">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-cream p-3 text-center outline-1 outline-ink/5">
                    <div className="headline text-2xl text-brand">{s.value}</div>
                    <div className="text-[11px] font-semibold text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {!profile.isMe && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className={`btn ${profile.isFollowing ? "btn-ghost" : "btn-brand"} w-full`}
                  onClick={() => onToggleFollow(profile.userId, !profile.isFollowing)}
                >
                  <Icon name={profile.isFollowing ? "userCheck" : "userPlus"} size={17} />
                  {profile.isFollowing ? t("profile.following") : t("profile.follow")}
                </button>

                {canJoinTheirRoom && (
                  <button type="button" className="btn btn-mint w-full" onClick={() => onJoinRoom(profile.currentRoomCode!)}>
                    <Icon name="arrowRight" size={17} />
                    {t("profile.joinTheirRoom")}
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm flex-1"
                    onClick={() => onReport(profile.userId, profile.username)}
                  >
                    <Icon name="flag" size={15} />
                    {t("report.open")}
                  </button>
                  {isAdmin &&
                    (profile.isBanned ? (
                      <button type="button" className="btn btn-orange btn-sm flex-1" onClick={() => onUnban?.(profile.userId)}>
                        {t("admin.unban")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm flex-1"
                        style={{ background: "var(--color-pink)", color: "#fff" }}
                        onClick={() => onBan?.(profile.userId, profile.username)}
                      >
                        {t("admin.ban")}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

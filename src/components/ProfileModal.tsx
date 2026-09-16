"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { ProfileView } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, Spinner } from "./ui";

/** Tap a player anywhere in the game to see their lifetime stats and follow them. */
export function ProfileModal({
  profile,
  loading,
  onClose,
  onToggleFollow,
  onJoinRoom,
}: {
  profile: ProfileView | null;
  loading: boolean;
  onClose: () => void;
  onToggleFollow: (userId: string, follow: boolean) => void;
  onJoinRoom: (code: string) => void;
}) {
  const { t } = useI18n();

  const stats = profile
    ? [
        { label: t("profile.gamesPlayed"), value: profile.gamesPlayed },
        { label: t("profile.wins"), value: profile.wins },
        { label: t("profile.roundsPlayed"), value: profile.roundsPlayed },
        { label: t("profile.avgPerRound"), value: profile.averagePerRound },
        { label: t("profile.totalPoints"), value: profile.totalPoints },
        { label: t("profile.bestScore"), value: profile.bestScore },
      ]
    : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card max-w-[340px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("header.profile")}>
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
                <div className="text-xs font-semibold text-muted">
                  {profile.online ? t("friends.online") : t("friends.offline")}
                </div>
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

            {profile.gamesPlayed === 0 ? (
              <p className="text-sm text-muted">{t("profile.noStats")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-[14px] border-2 border-line bg-cream p-2.5 text-center">
                    <div className="headline text-xl text-orange">{s.value}</div>
                    <div className="text-[11px] font-semibold text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {!profile.isMe && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className={`btn ${profile.isFollowing ? "btn-ghost" : "btn-primary"} w-full`}
                  onClick={() => onToggleFollow(profile.userId, !profile.isFollowing)}
                >
                  <Icon name={profile.isFollowing ? "userCheck" : "userPlus"} size={17} />
                  {profile.isFollowing ? t("profile.following") : t("profile.follow")}
                </button>
                {profile.currentRoomCode && (
                  <button type="button" className="btn btn-mint w-full" onClick={() => onJoinRoom(profile.currentRoomCode!)}>
                    <Icon name="arrowRight" size={17} />
                    {t("profile.joinTheirRoom")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

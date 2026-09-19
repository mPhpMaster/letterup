"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { levelFromPoints, tierFromRank, type Tier } from "@/lib/profileStats";
import type { GameResultView, ProfileDetails, ProfileView } from "@/lib/types";
import { Icon, type IconName } from "./Icon";
import { Avatar, CategoryTile, Spinner } from "./ui";

const TIER_STYLE: Record<Tier, string> = {
  legendary: "bg-ink text-accent",
  elite: "bg-grape text-white",
  pro: "bg-sky text-white",
};

/** Tap a player anywhere in the game to see their stats card, follow, challenge or report them. */
export function ProfileModal({
  profile,
  loading,
  myRoomCode = null,
  canChallenge = false,
  isAdmin = false,
  onClose,
  onToggleFollow,
  onJoinRoom,
  onChallenge,
  onReport,
  onBan,
  onUnban,
}: {
  profile: ProfileView | null;
  loading: boolean;
  /** Room the viewer is in, so we don't offer to join a room they're already in. */
  myRoomCode?: string | null;
  /** The viewer is in a room they can invite this player to. */
  canChallenge?: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onToggleFollow: (userId: string, follow: boolean) => void;
  onJoinRoom: (code: string) => void;
  onChallenge?: (userId: string) => void;
  onReport: (userId: string, username: string) => void;
  onBan?: (userId: string, username: string) => void;
  onUnban?: (userId: string) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card max-h-[92dvh] max-w-[600px] gap-0 overflow-hidden bg-cream p-0!"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t("header.profile")}
      >
        {loading || !profile ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : (
          <ProfileBody
            profile={profile}
            locale={locale}
            myRoomCode={myRoomCode}
            canChallenge={canChallenge}
            isAdmin={isAdmin}
            onClose={onClose}
            onToggleFollow={onToggleFollow}
            onJoinRoom={onJoinRoom}
            onChallenge={onChallenge}
            onReport={onReport}
            onBan={onBan}
            onUnban={onUnban}
          />
        )}
      </div>
    </div>
  );
}

function ProfileBody({
  profile,
  locale,
  myRoomCode,
  canChallenge,
  isAdmin,
  onClose,
  onToggleFollow,
  onJoinRoom,
  onChallenge,
  onReport,
  onBan,
  onUnban,
}: {
  profile: ProfileView;
  locale: string;
  myRoomCode: string | null;
  canChallenge: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onToggleFollow: (userId: string, follow: boolean) => void;
  onJoinRoom: (code: string) => void;
  onChallenge?: (userId: string) => void;
  onReport: (userId: string, username: string) => void;
  onBan?: (userId: string, username: string) => void;
  onUnban?: (userId: string) => void;
}) {
  const { t } = useI18n();
  const d = profile.details ?? null;
  // Level only needs lifetime points, so it still shows if the detail tables are missing.
  const level = d ? { level: d.level, xp: d.levelXp, needed: d.levelXpNeeded } : levelFromPoints(profile.totalPoints);
  const tier = tierFromRank(d?.rank ?? null);
  // Western digits in both languages, like the rest of the game.
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US");
  const n = (value: number) => nf.format(value);
  const canJoinTheirRoom = !profile.isMe && !!profile.currentRoomCode && profile.currentRoomCode !== myRoomCode;
  const showChallenge = !profile.isMe && canChallenge && profile.isFollowing && !!onChallenge && profile.currentRoomCode !== myRoomCode;
  const hasHistory = !!d && d.recordedGames > 0;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
        {/* Hero */}
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="animate-score-pop overflow-hidden rounded-3xl bg-paper p-1.5 shadow-[0_6px_0_var(--color-edge)]">
              <Avatar name={profile.username} url={profile.avatarUrl} size={84} />
            </div>
            <span className="headline absolute -end-2 -bottom-2 grid min-w-9 place-items-center rounded-xl bg-accent px-1.5 py-1 text-sm text-ink shadow-[0_3px_0_var(--color-accent-deep)]">
              {n(level.level)}
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            {tier && (
              <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${TIER_STYLE[tier]}`}>
                <Icon name="medal" size={13} />
                {t(`profile.tier.${tier}`)}
              </span>
            )}
            <h3 className="headline truncate text-3xl leading-tight" dir="auto">
              {profile.username}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold text-muted">
              <span className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${profile.online ? "bg-mint" : "bg-ink/20"}`} />
                {profile.online ? t("profile.onlineNow") : t("friends.offline")}
              </span>
              {d && <span>· {t("profile.memberSince", { year: new Date(d.memberSince).getFullYear() })}</span>}
            </p>
            <p className="mt-0.5 text-xs font-bold text-ink/45">
              {t("profile.followersCount", { count: profile.followers, num: n(profile.followers) })} ·{" "}
              {t("profile.followingLine", { num: n(profile.following) })}
            </p>
          </div>
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-grape/10 text-grape transition-transform active:scale-90"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <Icon name="close" size={18} strokeWidth={2.4} />
          </button>
        </div>

        {profile.isBanned && (
          <p className="mt-4 rounded-2xl bg-brand/10 px-3 py-2 text-sm font-bold text-brand" dir="auto">
            {t("profile.banned")}
            {profile.banReason ? ` — ${profile.banReason}` : ""}
          </p>
        )}

        {/* Rank + level */}
        <div className="mt-6 flex items-end gap-4">
          <div className="shrink-0">
            <p className="kicker">{t("profile.globalRank")}</p>
            <p className="headline text-5xl leading-none text-ink">{d?.rank ? `#${n(d.rank)}` : "—"}</p>
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-extrabold">
              <span>{t("profile.level", { level: n(level.level) })}</span>
              <span className="text-ink/50 tabular-nums" dir="ltr">
                {n(level.xp)} / {n(level.needed)} XP
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-grape/10">
              <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${(level.xp / level.needed) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Headline numbers */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="animate-rise rounded-3xl bg-brand p-5 text-white shadow-[0_6px_0_var(--color-brand-deep)]">
            <p className="text-xs font-extrabold opacity-85">{t("profile.winRate")}</p>
            <p className="headline mt-1 text-5xl leading-none tabular-nums">{profile.gamesPlayed > 0 ? `${n(profile.winRate)}%` : "—"}</p>
            <p className="mt-2 text-xs font-bold opacity-85">{t("profile.winRateOf", { count: profile.gamesPlayed })}</p>
          </div>
          <div className="animate-rise rounded-3xl bg-accent p-5 text-ink shadow-[0_6px_0_var(--color-accent-deep)]" style={{ animationDelay: "60ms" }}>
            <p className="text-xs font-extrabold opacity-70">{t("profile.totalPoints")}</p>
            <p className="headline mt-1 text-5xl leading-none tabular-nums">{n(profile.totalPoints)}</p>
            <p className="mt-2 text-xs font-bold opacity-70">{t("profile.bestGame", { score: n(profile.bestScore) })}</p>
          </div>
        </div>

        {profile.gamesPlayed === 0 ? (
          <p className="mt-6 rounded-3xl bg-paper p-5 text-center text-sm font-bold text-muted">{t("profile.noStats")}</p>
        ) : (
          <>
            {/* Career summary */}
            <SectionTitle kicker={t("profile.careerKicker")} title={t("profile.careerTitle")} icon="trophy" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <StatTile icon="gamepad" value={n(profile.gamesPlayed)} label={t("profile.games")} />
              <StatTile icon="trophy" value={n(profile.wins)} label={t("profile.wins")} />
              <StatTile icon="ban" value={d ? n(d.losses) : "—"} label={t("profile.losses")} />
              <StatTile icon="pulse" value={hasHistory ? n(d!.sharedWins) : "—"} label={t("profile.sharedWins")} />
              <StatTile icon="checkCircle" value={n(profile.roundsPlayed)} label={t("profile.roundsPlayed")} />
              <StatTile icon="target" value={d?.roundsCompletePercent != null ? `${n(d.roundsCompletePercent)}%` : "—"} label={t("profile.roundsComplete")} />
            </div>

            {!hasHistory ? (
              <p className="mt-6 rounded-3xl bg-paper p-5 text-center text-sm font-bold text-muted">{t("profile.noHistory")}</p>
            ) : (
              <>
                {/* Trend */}
                <SectionTitle
                  kicker={t("profile.trendKicker", { count: d!.recentGames.length })}
                  title={t("profile.trendTitle")}
                  aside={
                    d!.trendPercent !== null && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${d!.trendPercent >= 0 ? "bg-mint/20 text-mint-deep" : "bg-brand/10 text-brand"}`}
                        dir="ltr"
                      >
                        {d!.trendPercent >= 0 ? t("profile.trendUp", { percent: d!.trendPercent }) : t("profile.trendDown", { percent: d!.trendPercent })}
                      </span>
                    )
                  }
                />
                <TrendChart games={d!.recentGames} />

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <StreakCard icon="flame" label={t("profile.currentStreak")} value={t("profile.winsCount", { count: d!.currentStreak })} />
                  <StreakCard icon="medal" label={t("profile.longestStreak")} value={t("profile.winsCount", { count: d!.longestStreak })} />
                </div>
              </>
            )}

            {/* Category mastery */}
            {d && d.categories.length > 0 && <Mastery details={d} />}

            {d && (d.averageSubmitSeconds !== null || d.approvedWords > 0 || d.duelWinPercent !== null || d.groupWinPercent !== null) && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Panel icon="bolt" iconClass="text-brand" title={t("profile.speedTitle")}>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MiniStat value={d.averageSubmitSeconds !== null ? t("profile.seconds", { value: n(d.averageSubmitSeconds) }) : "—"} label={t("profile.avgFinish")} />
                    <MiniStat value={d.fastestSubmitSeconds !== null ? t("profile.seconds", { value: n(d.fastestSubmitSeconds) }) : "—"} label={t("profile.fastestRound")} />
                    <MiniStat value={d.pressurePercent !== null ? `${n(d.pressurePercent)}%` : "—"} label={t("profile.pressure")} />
                  </div>
                </Panel>

                <Panel icon="book" iconClass="text-mint-deep" title={t("profile.vocabTitle")}>
                  <p className="flex items-baseline gap-2">
                    <span className="headline text-4xl leading-none tabular-nums">{n(d.approvedWords)}</span>
                    <span className="text-xs font-bold text-muted">{t("profile.approvedWords")}</span>
                  </p>
                  <p className="mt-3 flex items-center justify-between text-sm font-bold">
                    <span className="text-ink/60">{t("profile.uniqueWords")}</span>
                    <span className="text-mint-deep tabular-nums">{d.uniqueWordsPercent !== null ? `${n(d.uniqueWordsPercent)}%` : "—"}</span>
                  </p>
                </Panel>

                <Panel icon="pulse" iconClass="text-accent-deep" title={t("profile.lettersTitle")}>
                  {d.topLetters.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {d.topLetters.map((letter, i) => (
                          <span
                            key={letter}
                            className={`headline grid size-10 place-items-center rounded-xl text-lg ${i === 0 ? "bg-accent text-ink" : i < 3 ? "bg-accent/30 text-ink" : "bg-grape/10 text-ink/70"}`}
                          >
                            {letter}
                          </span>
                        ))}
                      </div>
                      {d.longestWord && (
                        <p className="mt-3 text-xs font-bold text-muted">
                          <span className="text-ink" dir="auto">
                            {d.longestWord}
                          </span>{" "}
                          · {t("profile.longestWord", { count: Array.from(d.longestWord).length })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm font-bold text-muted">—</p>
                  )}
                </Panel>

                <Panel icon="swords" iconClass="text-grape" title={t("profile.challengesTitle")}>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-grape/10 p-3">
                      <p className="headline text-2xl tabular-nums">{d.duelWinPercent !== null ? `${n(d.duelWinPercent)}%` : "—"}</p>
                      <p className="text-xs font-bold text-muted">{t("profile.duelWins")}</p>
                    </div>
                    <div className="rounded-2xl bg-grape/10 p-3">
                      <p className="headline text-2xl tabular-nums">{d.groupWinPercent !== null ? `${n(d.groupWinPercent)}%` : "—"}</p>
                      <p className="text-xs font-bold text-muted">{t("profile.groupWins")}</p>
                    </div>
                  </div>
                </Panel>
              </div>
            )}
          </>
        )}
      </div>

      {!profile.isMe && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink/5 bg-paper/80 p-4 backdrop-blur sm:px-7">
          <button
            type="button"
            className={`btn min-w-[160px] flex-1 ${profile.isFollowing ? "btn-ghost" : "btn-brand"}`}
            onClick={() => onToggleFollow(profile.userId, !profile.isFollowing)}
          >
            <Icon name={profile.isFollowing ? "userCheck" : "userPlus"} size={18} />
            {profile.isFollowing ? t("profile.following") : t("profile.followPlayer")}
          </button>
          {canJoinTheirRoom && (
            <button type="button" className="btn btn-mint" onClick={() => onJoinRoom(profile.currentRoomCode!)}>
              <Icon name="arrowRight" size={18} className="rtl:-scale-x-100" />
              {t("profile.joinTheirRoom")}
            </button>
          )}
          {showChallenge && (
            <button type="button" className="btn btn-ghost" onClick={() => onChallenge!(profile.userId)}>
              <Icon name="swords" size={17} />
              {t("profile.challenge")}
            </button>
          )}
          <button type="button" className="btn btn-ghost flex-1 text-brand sm:flex-none" onClick={() => onReport(profile.userId, profile.username)}>
            <Icon name="flag" size={16} />
            {t("report.open")}
          </button>
          {isAdmin &&
            (profile.isBanned ? (
              <button type="button" className="btn btn-accent btn-sm" onClick={() => onUnban?.(profile.userId)}>
                {t("admin.unban")}
              </button>
            ) : (
              <button type="button" className="btn btn-sm bg-brand text-white" onClick={() => onBan?.(profile.userId, profile.username)}>
                {t("admin.ban")}
              </button>
            ))}
        </div>
      )}
    </>
  );
}

function SectionTitle({ kicker, title, icon, aside }: { kicker: string; title: string; icon?: IconName; aside?: ReactNode }) {
  return (
    <div className="mt-7 mb-3 flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <p className="kicker">{kicker}</p>
        <h4 className="headline flex items-center gap-2 text-xl">
          {title}
          {icon && <Icon name={icon} size={18} className="text-accent-deep" />}
        </h4>
      </div>
      {aside}
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-paper p-3.5 shadow-[0_4px_0_var(--color-edge)]">
      <p className="flex items-center justify-between gap-2">
        <span className="headline text-2xl tabular-nums">{value}</span>
        <Icon name={icon} size={17} className="text-brand" />
      </p>
      <p className="mt-0.5 truncate text-xs font-bold text-muted">{label}</p>
    </div>
  );
}

function StreakCard({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-grape/10 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
        <Icon name={icon} size={15} className="text-brand" />
        {label}
      </p>
      <p className="headline mt-1 text-xl">{value}</p>
    </div>
  );
}

function Panel({ icon, iconClass, title, children }: { icon: IconName; iconClass: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-paper p-4 shadow-[0_4px_0_var(--color-edge)]">
      <p className="mb-3 flex items-center justify-between gap-2 text-sm font-extrabold">
        {title}
        <Icon name={icon} size={18} className={iconClass} />
      </p>
      {children}
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="headline text-xl tabular-nums">{value}</p>
      <p className="text-[11px] leading-tight font-bold text-muted">{label}</p>
    </div>
  );
}

function Mastery({ details }: { details: ProfileDetails }) {
  const { t } = useI18n();
  const shown = details.categories.filter((c) => c.answered > 0).slice(0, 4);
  if (shown.length === 0) return null;
  const accuracy = (c: { answered: number; valid: number }) => Math.round((c.valid / c.answered) * 100);
  const best = shown.reduce((a, b) => (accuracy(b) > accuracy(a) ? b : a));
  const favorite = details.categories.reduce((a, b) => (b.valid > a.valid ? b : a));

  const tag = (c: (typeof shown)[number]) => {
    const pct = accuracy(c);
    if (c === best && shown.length > 1) return t("profile.tagBest");
    if (pct >= 80) return t("profile.tagHigh");
    if (pct >= 60) return t("profile.tagSolid");
    return t("profile.tagPractice");
  };
  const bar = (pct: number) => (pct >= 80 ? "bg-mint" : pct >= 60 ? "bg-accent" : "bg-brand");

  return (
    <>
      <SectionTitle
        kicker={t("profile.masteryKicker")}
        title={t("profile.masteryTitle")}
        aside={<span className="text-xs font-extrabold text-brand">{t("profile.favorite", { name: t(`categories.${favorite.category}`) })}</span>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
        {shown.map((c) => {
          const pct = accuracy(c);
          return (
            <div key={c.category} className="rounded-2xl bg-paper p-3 shadow-[0_4px_0_var(--color-edge)]">
              <p className="flex items-center gap-1.5">
                <CategoryTile id={c.category} size={26} />
                <span className="min-w-0 flex-1 truncate text-xs font-extrabold">{t(`categories.${c.category}`)}</span>
              </p>
              <p className="headline mt-2 text-2xl tabular-nums">{pct}%</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/5">
                <div className={`h-full rounded-full ${bar(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] font-bold text-muted">{tag(c)}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Scores of the recent games as a line, oldest on the left in both languages. */
function TrendChart({ games }: { games: GameResultView[] }) {
  const { t } = useI18n();
  const W = 320;
  const H = 120;
  const pad = 14;
  const max = Math.max(1, ...games.map((g) => g.score));
  const x = (i: number) => (games.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (games.length - 1));
  const y = (score: number) => H - pad - (score / max) * (H - pad * 2);
  const points = games.map((g, i) => `${x(i)},${y(g.score)}`).join(" ");
  const area = `${pad},${H - pad} ${points} ${x(games.length - 1)},${H - pad}`;

  return (
    <div className="rounded-3xl bg-paper p-4 shadow-[0_4px_0_var(--color-edge)]" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2)} y2={pad + f * (H - pad * 2)} stroke="var(--color-edge)" strokeDasharray="4 4" />
        ))}
        {games.length > 1 && <polygon points={area} fill="url(#trend-fill)" />}
        {games.length > 1 && <polyline points={points} fill="none" stroke="var(--color-brand)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {games.map((g, i) => (
          <circle key={i} cx={x(i)} cy={y(g.score)} r="5" fill="var(--color-paper)" stroke="var(--color-brand)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1">
        {games.map((g, i) => (
          <span
            key={i}
            title={`${g.score}`}
            className={`headline grid size-6 place-items-center rounded-lg text-[11px] ${g.won ? "bg-mint/25 text-mint-deep" : g.tied ? "bg-accent/30 text-ink" : "bg-brand/10 text-brand"}`}
          >
            {g.won ? t("profile.resultWin") : g.tied ? t("profile.resultTie") : t("profile.resultLoss")}
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscordSDK } from "@discord/embedded-app-sdk";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, getJson, postJson } from "@/lib/api";
import { bootDiscord, DiscordHandshakeTimeout, isEmbeddedInDiscord, type BootStep, type DiscordBoot } from "@/lib/discord";
import type { GameState, ProfileView, RoomSummary, SessionUser } from "@/lib/types";
import { useGame } from "@/hooks/useGame";
import { SOCIAL_CHANGED, useSocial } from "@/hooks/useSocial";
import { AdminPanel } from "./AdminPanel";
import { GameContext, type GameContextValue } from "./GameContext";
import { FriendsDrawer } from "./FriendsDrawer";
import { Icon } from "./Icon";
import { Leaderboard } from "./Leaderboard";
import { Login } from "./Login";
import { ProfileModal } from "./ProfileModal";
import { RoomChoice } from "./RoomChoice";
import { TextPrompt } from "./TextPrompt";
import { Lobby } from "./Lobby";
import { RoundPlay } from "./RoundPlay";
import { Voting } from "./Voting";
import { RoundResults } from "./RoundResults";
import { FinalLeaderboard } from "./FinalLeaderboard";
import { AppHeader, Avatar, ConfirmButton, Spinner } from "./ui";

type Phase =
  | { kind: "booting"; step: BootStep }
  | { kind: "login"; error?: string | null }
  | { kind: "rooms"; user: SessionUser }
  | { kind: "error"; message: string; messageKey?: string; hintKey?: string }
  | { kind: "game"; token: string | null; state: GameState; sdk?: DiscordSDK };

/** Modals shared by the home screen and the in-game screen. */
type Overlay =
  | { kind: "leaderboard" }
  | { kind: "admin" }
  | { kind: "suggest" }
  | { kind: "report"; userId: string; username: string }
  | { kind: "ban"; userId: string; username: string }
  | { kind: "password"; code: string; error?: string | null }
  | null;

const BOOT_RETRY_KEY = "lu_boot_retry";

/** True once per tab session, so a stuck handshake gets exactly one automatic reload. */
function claimBootRetry(): boolean {
  try {
    if (sessionStorage.getItem(BOOT_RETRY_KEY)) return false;
    sessionStorage.setItem(BOOT_RETRY_KEY, "1");
    return true;
  } catch {
    return false; // storage blocked: fall through to the error screen instead of looping
  }
}

function forgetBootRetry() {
  try {
    sessionStorage.removeItem(BOOT_RETRY_KEY);
  } catch {}
}

export default function App() {
  const { t, setLocale, hasStoredLocale } = useI18n();
  const [phase, setPhase] = useState<Phase>({ kind: "booting", step: "connecting" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const started = useRef(false);
  // Held on to so leaving a lobby can fall back to the room list instead of a
  // reload, and still offer the way back into this voice channel's Activity.
  const discordBoot = useRef<DiscordBoot | null>(null);
  const [signedIn, setSignedIn] = useState<SessionUser | null>(null);

  const roomFromUrl = () => new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";

  const flash = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2600);
  }, []);

  const enterGame = useCallback((state: GameState, token: string | null, sdk?: DiscordSDK) => {
    if (state.game.roomCode) {
      setRoomInUrl(state.game.roomCode);
    }
    setPhase({ kind: "game", token, state, sdk });
  }, []);

  // Boot: inside Discord we use the SDK; in a browser we rely on the cookie session.
  useEffect(() => {
    if (started.current) return; // StrictMode double-invoke guard
    started.current = true;

    (async () => {
      if (isEmbeddedInDiscord()) {
        try {
          const discord = await bootDiscord((step) => setPhase({ kind: "booting", step }));
          discordBoot.current = discord;
          setSignedIn(discord.user);
          if (!hasStoredLocale() && discord.locale?.toLowerCase().startsWith("ar")) setLocale("ar");
          setPhase({ kind: "booting", step: "joining" });
          const state = await postJson<GameState>("/api/game/join", { instanceId: discord.instanceId }, discord.token);
          const me = await getJson<{ isAdmin: boolean }>("/api/auth/me", discord.token).catch(() => ({ isAdmin: false }));
          setIsAdmin(me.isAdmin);
          forgetBootRetry();
          enterGame(state, discord.token, discord.sdk);
        } catch (err) {
          console.error(err);
          if (err instanceof DiscordHandshakeTimeout) {
            // Relaunching is what cleared this in testing, so do it once for the player.
            if (claimBootRetry()) {
              window.location.reload();
              return;
            }
            setPhase({ kind: "error", message: err.message, messageKey: "boot.timeout", hintKey: "boot.timeoutHint" });
          } else {
            setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
          }
        }
        return;
      }

      // No Discord here: "Connecting to Discord…" sat on screen for the whole sign-in check.
      setPhase({ kind: "booting", step: "authorizing" });
      const authError = new URLSearchParams(window.location.search).get("error");
      const me = await getJson<{ user: SessionUser | null; isAdmin: boolean }>("/api/auth/me").catch(() => ({
        user: null,
        isAdmin: false,
      }));
      setIsAdmin(me.isAdmin);
      if (!me.user) {
        setPhase({ kind: "login", error: authError });
        return;
      }
      setSignedIn(me.user);
      const code = roomFromUrl();
      if (code) {
        setPhase({ kind: "booting", step: "joining" });
        try {
          enterGame(await postJson<GameState>("/api/game/joinCode", { code }), null);
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) setOverlay({ kind: "password", code });
          else setJoinError(err instanceof ApiError ? err.message : String(err));
        }
      }
      setPhase({ kind: "rooms", user: me.user });
    })();
  }, [enterGame, hasStoredLocale, setLocale]);

  const token = phase.kind === "game" ? phase.token : null;

  /** Back into this voice channel's Activity game after stepping out of it. */
  const rejoinActivity = async () => {
    const boot = discordBoot.current;
    if (!boot) return;
    setBusy(true);
    setJoinError(null);
    try {
      enterGame(await postJson<GameState>("/api/game/join", { instanceId: boot.instanceId }, boot.token), boot.token, boot.sdk);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async (password?: string) => {
    setBusy(true);
    setJoinError(null);
    try {
      enterGame(await postJson<GameState>("/api/game/createRoom", { password }), null);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (code: string, password?: string) => {
    setBusy(true);
    setJoinError(null);
    try {
      enterGame(await postJson<GameState>("/api/game/joinCode", { code, password }), null);
      setOverlay(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setOverlay({ kind: "password", code, error: password ? t("rooms.passwordWrong") : null });
      } else {
        setJoinError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // Profile card contents are fetched on demand.
  useEffect(() => {
    if (!profileId) {
      setProfile(null);
      return;
    }
    let active = true;
    postJson<ProfileView>("/api/social/profile", { userId: profileId }, token ?? undefined)
      .then((p) => active && setProfile(p))
      .catch(() => active && setProfileId(null));
    return () => {
      active = false;
    };
  }, [profileId, token]);

  /** The session cookie is HttpOnly, so signing out has to go through the server. */
  /** Leaving a lobby lands on the room list; only reload if we never learned who is signed in. */
  const exitToRooms = (message?: string) => {
    if (message) flash(message);
    // Otherwise a refresh on the home screen joins the room you just left.
    setRoomInUrl(null);
    if (signedIn) setPhase({ kind: "rooms", user: signedIn });
    else window.location.href = "/";
  };

  const signOut = () => {
    void postJson("/api/auth/logout", {})
      .catch(() => {})
      .finally(() => {
        window.location.href = "/";
      });
  };

  const sendReport = async (userId: string, reason: string) => {
    try {
      await postJson("/api/social/report", { userId, reason }, token ?? undefined);
      flash(t("report.sent"));
    } catch (err) {
      flash(err instanceof Error ? err.message : t("errors.generic"));
    }
    setOverlay(null);
  };

  const sendSuggestion = async (body: string) => {
    try {
      await postJson("/api/social/suggest", { body }, token ?? undefined);
      flash(t("suggest.sent"));
    } catch (err) {
      flash(err instanceof Error ? err.message : t("errors.generic"));
    }
    setOverlay(null);
  };

  const setBan = async (userId: string, banned: boolean, reason?: string) => {
    try {
      await postJson(`/api/admin/${banned ? "ban" : "unban"}`, { userId, reason }, token ?? undefined);
      setProfile((p) => (p && p.userId === userId ? { ...p, isBanned: banned, banReason: reason ?? null } : p));
    } catch (err) {
      flash(err instanceof Error ? err.message : t("errors.generic"));
    }
    setOverlay(null);
  };

  const overlays = (
    <>
      {overlay?.kind === "leaderboard" && (
        <Leaderboard
          token={token}
          myUserId={phase.kind === "game" ? phase.state.me.userId : null}
          onClose={() => setOverlay(null)}
          onOpenProfile={(userId) => {
            setOverlay(null);
            setProfileId(userId);
          }}
          onReport={(userId, username) => setOverlay({ kind: "report", userId, username })}
        />
      )}
      {overlay?.kind === "admin" && <AdminPanel token={token} onClose={() => setOverlay(null)} />}
      {overlay?.kind === "suggest" && (
        <TextPrompt
          title={t("suggest.title")}
          subtitle={t("suggest.subtitle")}
          placeholder={t("suggest.placeholder")}
          submitLabel={t("suggest.send")}
          multiline
          onSubmit={sendSuggestion}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "report" && (
        <TextPrompt
          title={t("report.title", { name: overlay.username })}
          subtitle={t("report.subtitle")}
          placeholder={t("report.placeholder")}
          submitLabel={t("report.send")}
          multiline
          maxLength={1000}
          onSubmit={(reason) => void sendReport(overlay.userId, reason)}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "ban" && (
        <TextPrompt
          title={`${t("admin.ban")} — ${overlay.username}`}
          placeholder={t("admin.banReason")}
          submitLabel={t("admin.ban")}
          maxLength={500}
          onSubmit={(reason) => void setBan(overlay.userId, true, reason)}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "password" && (
        <TextPrompt
          title={t("rooms.passwordTitle")}
          subtitle={overlay.code}
          placeholder={t("rooms.passwordPlaceholder")}
          submitLabel={t("rooms.passwordSubmit")}
          password
          maxLength={64}
          busy={busy}
          error={overlay.error}
          onSubmit={(value) => void joinRoom(overlay.code, value)}
          onClose={() => setOverlay(null)}
        />
      )}
      {profileId && (
        <ProfileModal
          profile={profile}
          loading={!profile}
          myRoomCode={phase.kind === "game" ? phase.state.game.roomCode : null}
          canChallenge={phase.kind === "game"}
          onChallenge={(userId) => {
            if (phase.kind !== "game") return;
            // A challenge is an invite into the room you're in; the server checks you follow them.
            postJson("/api/social/invite", { userId, gameId: phase.state.game.id }, token ?? undefined)
              .then(() => flash(t("profile.challengeSent")))
              .catch((err) => flash(err instanceof Error ? err.message : t("errors.generic")));
          }}
          isAdmin={isAdmin}
          onClose={() => setProfileId(null)}
          onToggleFollow={(userId, follow) => {
            void postJson("/api/social/follow", { userId, follow }, token ?? undefined)
              .catch(() => {})
              // The friends drawer polls every 20s; don't leave it saying "not following anyone".
              .finally(() => window.dispatchEvent(new Event(SOCIAL_CHANGED)));
            setProfile((p) =>
              p && p.isFollowing !== follow ? { ...p, isFollowing: follow, followers: Math.max(0, p.followers + (follow ? 1 : -1)) } : p,
            );
          }}
          onJoinRoom={(code) => {
            window.location.href = `/?room=${code}`;
          }}
          onReport={(userId, username) => setOverlay({ kind: "report", userId, username })}
          onBan={(userId, username) => setOverlay({ kind: "ban", userId, username })}
          onUnban={(userId) => void setBan(userId, false)}
        />
      )}
      {notice && (
        <div role="status" className="animate-rise fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md rounded-3xl bg-ink px-5 py-3.5 text-center text-sm font-bold text-cream shadow-[0_6px_0_var(--color-ink-deep)]">
          <span dir="auto">{notice}</span>
        </div>
      )}
    </>
  );

  if (phase.kind === "game") {
    return (
      <>
        <GameScreen
          token={phase.token}
          initial={phase.state}
          sdk={phase.sdk}
          isAdmin={isAdmin}
          onOpenProfile={setProfileId}
          onOpenLeaderboard={() => setOverlay({ kind: "leaderboard" })}
          onOpenAdmin={() => setOverlay({ kind: "admin" })}
          onExit={exitToRooms}
        />
        {overlays}
      </>
    );
  }

  if (phase.kind === "login") return <Login error={phase.error} next={roomFromUrl() ? `/?room=${roomFromUrl()}` : "/"} />;

  if (phase.kind === "rooms") {
    return (
      <>
        <RoomChoice
          user={phase.user}
          token={discordBoot.current?.token ?? null}
          isAdmin={isAdmin}
          onCreate={(password) => void createRoom(password)}
          onJoin={(code) => void joinRoom(code)}
          onJoinRoom={(room: RoomSummary) =>
            room.hasPassword ? setOverlay({ kind: "password", code: room.roomCode }) : void joinRoom(room.roomCode)
          }
          onOpenLeaderboard={() => setOverlay({ kind: "leaderboard" })}
          onOpenSuggest={() => setOverlay({ kind: "suggest" })}
          onOpenAdmin={() => setOverlay({ kind: "admin" })}
          onOpenProfile={setProfileId}
          onSignOut={signOut}
          busy={busy}
          error={joinError}
          initialCode={roomFromUrl()}
        >
          {/* Inside the Activity this is the way back to the game in this voice channel. */}
          {discordBoot.current && (
            <button type="button" className="btn btn-discord text-base" onClick={() => void rejoinActivity()} disabled={busy}>
              <Icon name="play" size={18} filled />
              {t("room.backToActivity")}
            </button>
          )}
          <PendingInvites onJoin={(code) => void joinRoom(code)} />
        </RoomChoice>
        {overlays}
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-3 sm:gap-5 sm:p-5">
      <AppHeader subtitle={t("app.title")} />
      <main className="flex flex-1 flex-col items-center justify-center pb-10">
        <section className="card-pop animate-rise flex w-full max-w-md flex-col items-center gap-5 text-center">
          <span className="headline animate-pop-letter grid size-24 place-items-center rounded-[30px] bg-accent text-6xl text-ink shadow-[0_10px_0_var(--color-accent-deep)]">
            L
          </span>
          {/* The game's name belongs on the splash; the long description sits under it. */}
          <div>
            <h1 className="headline text-4xl text-brand">{t("app.short")}</h1>
            <p className="kicker mt-1">{t("app.title")}</p>
          </div>
          {phase.kind === "booting" && (
            <>
              <Spinner />
              <p className="animate-pulse-soft headline text-base text-ink/60">{t(`boot.${phase.step}`)}</p>
            </>
          )}
          {phase.kind === "error" && (
            <div className="w-full rounded-3xl bg-brand/10 p-4 text-start">
              <p className="headline text-lg text-brand">{t("boot.failed")}</p>
              <p className="mt-1 text-sm font-semibold break-words text-ink/70" dir={phase.messageKey ? undefined : "ltr"}>
                {phase.messageKey ? t(phase.messageKey) : phase.message}
              </p>
              <p className="mt-3 text-sm text-muted">{t(phase.hintKey ?? "boot.hint")}</p>
              <button type="button" className="btn btn-brand mt-4 w-full" onClick={() => window.location.reload()}>
                {t("common.retry")}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/** Invitations waiting on the room-choice screen. */
function PendingInvites({ onJoin }: { onJoin: (code: string) => void }) {
  const { t } = useI18n();
  const { social, dismissInvite } = useSocial(null, null);
  if (social.invites.length === 0) return null;
  return (
    <div className="card-pop-sm animate-rise flex flex-col gap-2">
      <h2 className="headline text-lg">💌 {t("invites.title")}</h2>
      {social.invites.map((invite) => (
        <div key={invite.id} className="flex items-center gap-2.5 rounded-2xl bg-cream p-2">
          <Avatar name={invite.fromUsername} url={invite.fromAvatarUrl} size={32} />
          <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
            {t("invites.fromLine", { name: invite.fromUsername })}
          </span>
          {invite.roomCode && (
            <button type="button" className="btn btn-mint btn-sm" onClick={() => onJoin(invite.roomCode!)}>
              {t("invites.join")}
            </button>
          )}
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink/5 text-ink/45 transition-transform active:scale-90"
            aria-label={t("invites.dismiss")}
            onClick={() => void dismissInvite(invite.id)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function useDiscordParticipants(sdk: DiscordSDK | undefined, onChange: () => void): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!sdk) return;
    let active = true;
    const handle = (event: { participants: { id: string }[] }) => {
      if (!active) return;
      setIds(new Set(event.participants.map((p) => p.id)));
      onChange();
    };
    sdk.commands.getInstanceConnectedParticipants().then(handle).catch(console.warn);
    sdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", handle).catch(console.warn);
    return () => {
      active = false;
      sdk.unsubscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", handle).catch(() => {});
    };
  }, [sdk, onChange]);
  return ids;
}

function GameScreen({
  token,
  initial,
  sdk,
  isAdmin,
  onOpenProfile,
  onOpenLeaderboard,
  onOpenAdmin,
  onExit,
}: {
  token: string | null;
  initial: GameState;
  sdk?: DiscordSDK;
  isAdmin: boolean;
  onOpenProfile: (userId: string) => void;
  onOpenLeaderboard: () => void;
  onOpenAdmin: () => void;
  onExit: (message?: string) => void;
}) {
  const { t } = useI18n();
  const { state, offset, error, gone, clearError, call, refresh } = useGame(token, initial);
  const participantIds = useDiscordParticipants(sdk, refresh);
  const social = useSocial(token, state.game.id);

  const [showFriends, setShowFriends] = useState(false);
  const [goHomeOpen, setGoHomeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const inviteUrl = state.game.roomCode ? `${window.location.origin}/?room=${state.game.roomCode}` : null;
  const copyInvite = inviteUrl
    ? () => {
        navigator.clipboard
          ?.writeText(inviteUrl)
          .then(() => flash(t("lobby.linkCopied")))
          .catch(() => flash(t("lobby.copyFailed", { link: inviteUrl })));
      }
    : null;

  // Discord's own dialog is the quickest way to pull in someone already in the
  // server, and it only exists while we are running inside the Activity.
  const openDiscordInvite = sdk
    ? () => {
        void sdk.commands.openInviteDialog().catch(() => flash(t("errors.generic")));
      }
    : null;

  // A reload was fine on the web, but inside the Activity it re-runs the boot,
  // which rejoins this channel's game -- so leaving looked like the game had shut
  // and reopened. Hand control back to the shell and let it show the room list.
  const goHome = () => onExit();

  // Removed from the room (kicked, or the room was cleaned up): say so and go home.
  useEffect(() => {
    if (gone) onExit(t("errors.roomGone"));
  }, [gone, onExit, t]);

  const leaveRoom = () => {
    void postJson("/api/game/leave", { gameId: state.game.id }, token ?? undefined)
      .catch(() => {})
      .finally(goHome);
  };

  const ctx = useMemo<GameContextValue>(() => {
    const host = state.players.find((p) => p.isHost);
    return {
      state,
      me: state.players.find((p) => p.id === state.me.playerId),
      isHost: state.game.hostUserId === state.me.userId,
      hostName: host?.username ?? t("common.host"),
      offset,
      participantIds,
      call,
      refresh,
      openProfile: onOpenProfile,
      openFriends: () => setShowFriends(true),
      copyInvite,
      openDiscordInvite,
      leaveRoom,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaveRoom/copyInvite close over stable values
  }, [state, offset, participantIds, call, refresh, copyInvite, onOpenProfile, t]);

  const { status } = state.game;
  const inGame = status === "playing" || status === "voting" || status === "results";

  // A new phase is a new screen: start it from the top, not wherever the last one was
  // scrolled to (voting opened with its title card already scrolled out of view).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [status, state.round?.id]);

  return (
    <GameContext.Provider value={ctx}>
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-3 pb-8 sm:gap-5 sm:p-5">
        {/* Tapping the logo leaves the game screen — always with a confirmation. */}
        <AppHeader
          subtitle={
            inGame
              ? t("header.round", { current: state.game.currentRound, total: state.settings.totalRounds })
              : status === "finished"
                ? t("header.gameOver")
                : t("app.title")
          }
          badge={inGame ? t("header.roundLong", { current: state.game.currentRound, total: state.settings.totalRounds }) : undefined}
          onLogoClick={() => setGoHomeOpen(true)}
          logoLabel={t("nav.goHomeTitle")}
        >
          <button type="button" className="tool" onClick={onOpenLeaderboard} aria-label={t("leaderboard.open")} title={t("leaderboard.open")}>
            <Icon name="crown" size={19} />
          </button>
          <button type="button" className="tool relative" onClick={() => setShowFriends(true)} aria-label={t("header.friends")} title={t("header.friends")}>
            <Icon name="users" size={19} />
            {social.social.invites.length > 0 && (
              <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-brand text-[10px] font-extrabold text-white ring-2 ring-paper">
                {social.social.invites.length}
              </span>
            )}
          </button>
          {isAdmin && (
            <button type="button" className="tool" onClick={onOpenAdmin} aria-label={t("admin.open")} title={t("admin.open")}>
              <Icon name="sealCheck" size={19} />
            </button>
          )}
          {inGame && ctx.isHost && (
            <ConfirmButton compact className="tool" onConfirm={() => void call("lobby")}>
              <Icon name="replay" size={17} />
              <span className="sr-only">{t("header.endGame")}</span>
            </ConfirmButton>
          )}
        </AppHeader>

        {/* Bottom padding keeps the sticky action buttons clear of the last row on mobile. */}
        <main className="flex flex-1 flex-col gap-4 pb-24 sm:gap-5">
          {status === "lobby" && <Lobby />}
          {status === "playing" && state.round && <RoundPlay key={state.round.id} />}
          {status === "voting" && state.round && <Voting />}
          {status === "results" && state.round && <RoundResults />}
          {status === "finished" && <FinalLeaderboard />}
        </main>

        {showFriends && (
          <FriendsDrawer
            social={social.social}
            token={token}
            canInvite={!!state.game.roomCode}
            roomUserIds={new Set(state.players.map((p) => p.userId))}
            onClose={() => setShowFriends(false)}
            onFollow={(userId, follow) => void social.follow(userId, follow)}
            onInvite={(userId) => void social.invite(userId)}
            onJoinRoom={(code) => {
              window.location.href = `/?room=${code}`;
            }}
            onOpenProfile={(userId) => {
              setShowFriends(false);
              onOpenProfile(userId);
            }}
          />
        )}

        {goHomeOpen && (
          <div className="modal-backdrop" onClick={() => setGoHomeOpen(false)}>
            <div className="modal-card max-w-[360px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("nav.goHomeTitle")}>
              <h3 className="headline text-xl">{t("nav.goHomeTitle")}</h3>
              <p className="text-sm text-muted">{t("nav.goHomeBody")}</p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setGoHomeOpen(false)}>
                  {t("nav.stay")}
                </button>
                <button type="button" className="btn btn-brand flex-1" onClick={goHome}>
                  {t("nav.goHomeConfirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {(error || toast) && (
          <div
            role="alert"
            className="animate-rise fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-ink px-5 py-3 text-cream shadow-[0_6px_0_var(--color-ink-deep)]"
          >
            <span className="flex-1 text-sm font-bold" dir="auto">
              {error ?? toast}
            </span>
            {error && (
              <button type="button" className="btn btn-accent btn-sm" onClick={clearError}>
                {t("common.dismiss")}
              </button>
            )}
          </div>
        )}
      </div>
    </GameContext.Provider>
  );
}

/**
 * Keep the address bar (and tab title) on the room you're in. The server-rendered
 * title only knows the room the page was first opened with.
 */
function setRoomInUrl(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url);
  document.title = code ? `🎈 Room ${code} · LetterUp` : "LetterUp — Human, Animal, Plant, Object";
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscordSDK } from "@discord/embedded-app-sdk";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, getJson, postJson } from "@/lib/api";
import { bootDiscord, isEmbeddedInDiscord, type BootStep, type DiscordBoot } from "@/lib/discord";
import type { GameState, ProfileView, RoomSummary, SessionUser } from "@/lib/types";
import { useGame } from "@/hooks/useGame";
import { useSocial } from "@/hooks/useSocial";
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
import { Avatar, ConfirmButton, LanguageToggle, Spinner } from "./ui";

type Phase =
  | { kind: "booting"; step: BootStep }
  | { kind: "login"; error?: string | null }
  | { kind: "rooms"; user: SessionUser }
  | { kind: "error"; message: string }
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
      const url = new URL(window.location.href);
      url.searchParams.set("room", state.game.roomCode);
      window.history.replaceState(null, "", url);
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
          enterGame(state, discord.token, discord.sdk);
        } catch (err) {
          console.error(err);
          setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

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
  const exitToRooms = () => {
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
          isAdmin={isAdmin}
          onClose={() => setProfileId(null)}
          onToggleFollow={(userId, follow) => {
            void postJson("/api/social/follow", { userId, follow }, token ?? undefined).catch(() => {});
            setProfile((p) => (p ? { ...p, isFollowing: follow } : p));
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
        <div role="status" className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md rounded-[16px] border-2 border-line bg-card px-4 py-3 text-center text-sm font-semibold shadow-lg">
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="headline grid size-[72px] place-items-center rounded-[22px] bg-orange text-[34px] text-white">L</span>
        {/* The game's name belongs on the splash; the long description sits under it. */}
        <div>
          <h1 className="headline text-[28px]">{t("app.short")}</h1>
          <p className="mt-1 text-[13px] text-muted">{t("app.title")}</p>
        </div>
        {phase.kind === "booting" && (
          <>
            <Spinner />
            <p className="text-muted">{t(`boot.${phase.step}`)}</p>
          </>
        )}
        {phase.kind === "error" && (
          <div className="card w-full text-start">
            <p className="headline text-pink">{t("boot.failed")}</p>
            <p className="mt-1 break-words text-sm text-muted" dir="ltr">
              {phase.message}
            </p>
            <p className="mt-3 text-sm text-muted">{t("boot.hint")}</p>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => window.location.reload()}>
              {t("common.retry")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/** Invitations waiting on the room-choice screen. */
function PendingInvites({ onJoin }: { onJoin: (code: string) => void }) {
  const { t } = useI18n();
  const { social, dismissInvite } = useSocial(null, null);
  if (social.invites.length === 0) return null;
  return (
    <div className="card flex flex-col gap-2">
      <h2 className="headline text-base">{t("invites.title")}</h2>
      {social.invites.map((invite) => (
        <div key={invite.id} className="flex items-center gap-2.5">
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
            className="btn btn-icon"
            style={{ background: "transparent", color: "var(--color-sand)" }}
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
  onExit: () => void;
}) {
  const { t } = useI18n();
  const { state, offset, error, clearError, call, refresh } = useGame(token, initial);
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

  return (
    <GameContext.Provider value={ctx}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col px-4 pb-6">
        <header className="flex items-center gap-1.5 border-b-2 border-line py-2.5 sm:gap-2.5 sm:py-3">
          {/* Tapping the name leaves the game screen — always with a confirmation. */}
          <button
            type="button"
            className="me-auto flex min-w-0 items-center gap-2"
            onClick={() => setGoHomeOpen(true)}
            aria-label={t("nav.goHomeTitle")}
          >
            <span className="headline grid size-8 shrink-0 place-items-center rounded-[10px] bg-orange text-[17px] text-white sm:size-9 sm:text-[19px]">
              L
            </span>
            <span className="headline hidden truncate text-[17px] min-[430px]:inline sm:text-[19px]">{t("app.short")}</span>
          </button>
          {inGame && (
            <span className="pill text-[11px] whitespace-nowrap sm:text-[12px]" style={{ background: "var(--color-sun)", borderColor: "transparent" }}>
              {t("header.round", { current: state.game.currentRound, total: state.settings.totalRounds })}
            </span>
          )}
          <button type="button" className="btn btn-ghost btn-icon shrink-0" onClick={onOpenLeaderboard} aria-label={t("leaderboard.open")}>
            <Icon name="crown" size={17} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon relative shrink-0" onClick={() => setShowFriends(true)} aria-label={t("header.friends")}>
            <Icon name="users" size={17} />
            {social.social.invites.length > 0 && (
              <span className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-pink text-[10px] font-bold text-white">
                {social.social.invites.length}
              </span>
            )}
          </button>
          {isAdmin && (
            <button type="button" className="btn btn-ghost btn-icon shrink-0" onClick={onOpenAdmin} aria-label={t("admin.open")}>
              <Icon name="sealCheck" size={17} />
            </button>
          )}
          {inGame && ctx.isHost && (
            <ConfirmButton onConfirm={() => void call("lobby")}>
              <Icon name="replay" size={15} />
              <span className="hidden sm:inline">{t("header.endGame")}</span>
            </ConfirmButton>
          )}
          <LanguageToggle />
        </header>

        {/* Bottom padding keeps the sticky action buttons clear of the last row on mobile. */}
        <main className="flex flex-1 flex-col gap-4 pt-4 pb-24">
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
            <div className="modal-card max-w-[340px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("nav.goHomeTitle")}>
              <h3 className="headline text-[19px]">{t("nav.goHomeTitle")}</h3>
              <p className="text-sm text-muted">{t("nav.goHomeBody")}</p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setGoHomeOpen(false)}>
                  {t("nav.stay")}
                </button>
                <button type="button" className="btn btn-primary flex-1" onClick={goHome}>
                  {t("nav.goHomeConfirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {(error || toast) && (
          <div
            role="alert"
            className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-[16px] border-2 border-line bg-card px-4 py-3 shadow-lg"
          >
            <span className="flex-1 text-sm font-semibold" dir="auto">
              {error ?? toast}
            </span>
            {error && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearError}>
                {t("common.dismiss")}
              </button>
            )}
          </div>
        )}
      </div>
    </GameContext.Provider>
  );
}

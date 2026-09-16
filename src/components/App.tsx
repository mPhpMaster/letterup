"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscordSDK } from "@discord/embedded-app-sdk";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, getJson, postJson } from "@/lib/api";
import { bootDiscord, isEmbeddedInDiscord, type BootStep } from "@/lib/discord";
import type { GameState, ProfileView, SessionUser } from "@/lib/types";
import { useGame } from "@/hooks/useGame";
import { useSocial } from "@/hooks/useSocial";
import { GameContext, type GameContextValue } from "./GameContext";
import { FriendsDrawer } from "./FriendsDrawer";
import { Icon } from "./Icon";
import { Login } from "./Login";
import { ProfileModal } from "./ProfileModal";
import { RoomChoice } from "./RoomChoice";
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

export default function App() {
  const { t, setLocale, hasStoredLocale } = useI18n();
  const [phase, setPhase] = useState<Phase>({ kind: "booting", step: "connecting" });
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const started = useRef(false);

  const roomFromUrl = () => new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";

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
          if (!hasStoredLocale() && discord.locale?.toLowerCase().startsWith("ar")) setLocale("ar");
          setPhase({ kind: "booting", step: "joining" });
          const state = await postJson<GameState>("/api/game/join", { instanceId: discord.instanceId }, discord.token);
          enterGame(state, discord.token, discord.sdk);
        } catch (err) {
          console.error(err);
          setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      const authError = new URLSearchParams(window.location.search).get("error");
      const { user } = await getJson<{ user: SessionUser | null }>("/api/auth/me").catch(() => ({ user: null }));
      if (!user) {
        setPhase({ kind: "login", error: authError });
        return;
      }
      const code = roomFromUrl();
      if (code) {
        try {
          enterGame(await postJson<GameState>("/api/game/joinCode", { code }), null);
          return;
        } catch (err) {
          setJoinError(err instanceof ApiError ? err.message : String(err));
        }
      }
      setPhase({ kind: "rooms", user });
    })();
  }, [enterGame, hasStoredLocale, setLocale]);

  const createRoom = async () => {
    setBusy(true);
    setJoinError(null);
    try {
      enterGame(await postJson<GameState>("/api/game/createRoom", {}), null);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (code: string) => {
    setBusy(true);
    setJoinError(null);
    try {
      enterGame(await postJson<GameState>("/api/game/joinCode", { code }), null);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === "game") return <GameScreen token={phase.token} initial={phase.state} sdk={phase.sdk} />;
  if (phase.kind === "login") return <Login error={phase.error} next={roomFromUrl() ? `/?room=${roomFromUrl()}` : "/"} />;
  if (phase.kind === "rooms") {
    return (
      <RoomChoice user={phase.user} onCreate={createRoom} onJoin={joinRoom} busy={busy} error={joinError} initialCode={roomFromUrl()}>
        <PendingInvites onJoin={joinRoom} />
      </RoomChoice>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="headline grid size-[72px] place-items-center rounded-[22px] bg-orange text-[34px] text-white">L</span>
        <h1 className="headline text-2xl">{t("app.title")}</h1>
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

function GameScreen({ token, initial, sdk }: { token: string | null; initial: GameState; sdk?: DiscordSDK }) {
  const { t } = useI18n();
  const { state, offset, error, clearError, call, refresh } = useGame(token, initial);
  const participantIds = useDiscordParticipants(sdk, refresh);
  const social = useSocial(token, state.game.id);

  const [showFriends, setShowFriends] = useState(false);
  const [goHomeOpen, setGoHomeOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    if (!profileId) {
      setProfile(null);
      return;
    }
    let active = true;
    social
      .loadProfile(profileId)
      .then((p) => active && setProfile(p))
      .catch(() => active && setProfileId(null));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProfile identity changes every render
  }, [profileId]);

  const inviteUrl = state.game.roomCode ? `${window.location.origin}/?room=${state.game.roomCode}` : null;
  const copyInvite = inviteUrl
    ? () => {
        navigator.clipboard
          ?.writeText(inviteUrl)
          .then(() => flash(t("lobby.linkCopied")))
          .catch(() => flash(t("lobby.copyFailed", { link: inviteUrl })));
      }
    : null;

  const goHome = () => {
    window.location.href = "/";
  };

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
      openProfile: setProfileId,
      openFriends: () => setShowFriends(true),
      copyInvite,
      leaveRoom,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaveRoom closes over stable values
  }, [state, offset, participantIds, call, refresh, copyInvite, t]);

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
            <span className="headline truncate text-[17px] sm:text-[19px]">{t("app.short")}</span>
          </button>
          {inGame && (
            <span className="pill text-[11px] whitespace-nowrap sm:text-[12px]" style={{ background: "var(--color-sun)", borderColor: "transparent" }}>
              {t("header.round", { current: state.game.currentRound, total: state.settings.totalRounds })}
            </span>
          )}
          <button type="button" className="btn btn-ghost btn-icon relative shrink-0" onClick={() => setShowFriends(true)} aria-label={t("header.friends")}>
            <Icon name="users" size={17} />
            {social.social.invites.length > 0 && (
              <span className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-pink text-[10px] font-bold text-white">
                {social.social.invites.length}
              </span>
            )}
          </button>
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
              setProfileId(userId);
            }}
          />
        )}

        {profileId && (
          <ProfileModal
            profile={profile}
            loading={!profile}
            myRoomCode={state.game.roomCode}
            onClose={() => setProfileId(null)}
            onToggleFollow={(userId, follow) => {
              void social.follow(userId, follow);
              setProfile((p) => (p ? { ...p, isFollowing: follow } : p));
            }}
            onJoinRoom={(code) => {
              window.location.href = `/?room=${code}`;
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

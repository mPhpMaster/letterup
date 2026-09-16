"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { rankByScore } from "@/lib/ranking";
import { useGameContext } from "./GameContext";
import { Icon } from "./Icon";
import { Avatar, PlayerName } from "./ui";

const CONFETTI_COLORS = ["#ffd166", "#ff8a3d", "#ff5d8f", "#06d6a0", "#7b5cff"];

export function FinalLeaderboard() {
  const { state, isHost, hostName, call, openProfile } = useGameContext();
  const { t } = useI18n();
  const ranked = rankByScore(state.players);
  const winners = ranked.filter((p) => p.rank === 1);
  // Visual order 2nd · 1st · 3rd (flex follows document direction, so RTL mirrors it)
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
  const rest = ranked.slice(3);

  const headline =
    winners.length === 1
      ? t("final.winner", { name: winners[0].username })
      : t("final.tie", { names: winners.map((w) => w.username).join(t("final.listSeparator")) });

  return (
    <div className="animate-rise relative flex flex-col items-center gap-5 overflow-hidden pb-3">
      <Confetti />
      <h2 className="headline text-center text-[28px]">{t("final.title")} 🎊</h2>
      <p className="text-center text-[17px] font-bold text-orange" dir="auto">
        {headline}
      </p>

      <div className="flex w-full items-end justify-center gap-3">
        {podium.map((p) => (
          <div key={p.id} className="flex w-[92px] flex-col items-center gap-1.5">
            {p.rank === 1 && <Icon name="crown" size={24} className="text-amber" filled />}
            <Avatar
              name={p.username}
              url={p.avatarUrl}
              size={p.rank === 1 ? 58 : 46}
              ring={p.rank === 1 ? "3px solid var(--color-amber)" : "2px solid var(--color-line)"}
            />
            <button type="button" className="w-full truncate text-center text-[12px] font-bold" onClick={() => openProfile(p.userId)}>
              {p.username}
            </button>
            <span className="headline text-orange">{p.score}</span>
            <div
              className="headline flex w-full justify-center rounded-t-[10px] pt-1.5 text-[20px]"
              style={{
                height: p.rank === 1 ? 66 : p.rank === 2 ? 48 : 34,
                background: p.rank === 1 ? "var(--color-sun)" : "var(--color-card)",
                border: p.rank === 1 ? "none" : "2px solid var(--color-line)",
                color: p.rank === 1 ? "var(--color-ink)" : "var(--color-sand)",
              }}
            >
              {p.rank}
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="flex w-full flex-col gap-1.5">
          {rest.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-[14px] border-2 border-line bg-card px-3 py-2">
              <span className="headline w-5 text-[13px] text-sand">{p.rank}</span>
              <Avatar name={p.username} url={p.avatarUrl} size={28} />
              <span className="min-w-0 flex-1 text-[13px]">
                <PlayerName player={p} meId={state.me.playerId} onClick={() => openProfile(p.userId)} />
              </span>
              <span className="headline text-[14px] text-orange">{p.score}</span>
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-3 z-10 w-full">
        {isHost ? (
          <button type="button" className="btn btn-primary w-full text-base" onClick={() => void call("lobby")}>
            <Icon name="replay" size={18} />
            {t("final.playAgain")}
          </button>
        ) : (
          <div className="waiting">
            <Icon name="hourglass" size={16} className="me-1.5 inline" />
            {t("final.waitingHost", { name: hostName })}
          </div>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            insetInlineStart: `${(i * 41) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 7) * 0.3}s`,
            animationDuration: `${2.4 + (i % 5) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

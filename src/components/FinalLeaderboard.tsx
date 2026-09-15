"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { rankByScore } from "@/lib/ranking";
import { useGameContext } from "./GameContext";
import { Avatar, PlayerName } from "./ui";

const CONFETTI_COLORS = ["#ffc93d", "#7b5cff", "#37d99a", "#ff5c74", "#5cc8ff"];
const PODIUM_HEIGHT: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-14" };
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function FinalLeaderboard() {
  const { state, isHost, hostName, call } = useGameContext();
  const { t } = useI18n();
  const ranked = rankByScore(state.players);
  const winners = ranked.filter((p) => p.rank === 1);
  // Visual order 2nd · 1st · 3rd (flex follows the document direction, so RTL mirrors naturally)
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);

  const headline =
    winners.length === 1
      ? t("final.winner", { name: winners[0].username })
      : t("final.tie", { names: winners.map((w) => w.username).join(t("final.listSeparator")) });

  return (
    <div className="animate-rise space-y-4">
      <Confetti />
      <div className="card text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-muted">{t("final.title")}</p>
        <h2 className="mt-1 text-2xl font-black text-sun sm:text-3xl" dir="auto">
          🏆 {headline}
        </h2>

        <div className="mt-6 flex items-end justify-center gap-2 sm:gap-4">
          {podium.map((p) => (
            <div key={p.id} className="flex w-24 min-w-0 flex-col items-center sm:w-32">
              <span className="text-2xl">{p.rank === 1 ? "👑" : MEDAL[p.rank] ?? ""}</span>
              <Avatar name={p.username} url={p.avatarUrl} size={p.rank === 1 ? 64 : 48} />
              <span className="mt-1 w-full truncate text-sm font-bold">{p.username}</span>
              <span className="text-xs font-bold tabular-nums text-muted">{t("common.points", { count: p.score })}</span>
              <div
                className={`mt-2 w-full rounded-t-xl ${PODIUM_HEIGHT[p.rank] ?? "h-10"} ${
                  p.rank === 1 ? "bg-sun/80" : p.rank === 2 ? "bg-brand/60" : "bg-surface-2"
                } grid place-items-center text-2xl font-black text-bg`}
              >
                {p.rank}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ol className="card space-y-2">
        {ranked.map((p) => (
          <li key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${p.rank === 1 ? "bg-sun/10 ring-1 ring-sun/40" : "bg-surface-2"}`}>
            <span className="w-7 text-center text-lg font-extrabold tabular-nums">{MEDAL[p.rank] ?? p.rank}</span>
            <Avatar name={p.username} url={p.avatarUrl} size={34} />
            <span className="min-w-0 flex-1">
              <PlayerName player={p} meId={state.me.playerId} />
            </span>
            <span className="text-lg font-extrabold tabular-nums">{p.score}</span>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-3 z-10">
        {isHost ? (
          <button type="button" className="btn btn-sun w-full text-lg shadow-xl" onClick={() => void call("lobby")}>
            🔁 {t("final.playAgain")}
          </button>
        ) : (
          <p className="rounded-xl border border-line bg-surface/95 px-4 py-3 text-center text-sm text-muted shadow-xl backdrop-blur">
            {t("final.waitingHost", { name: hostName })}
          </p>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 48 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            insetInlineStart: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 12) * 0.2}s`,
            animationDuration: `${2.6 + (i % 5) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

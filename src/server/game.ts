import type { PostgrestError } from "@supabase/supabase-js";
import { admin } from "./supabase-admin";
import { CATEGORY_IDS } from "@/lib/categories";
import { normalizeAnswer, pickLetter, startsWithLetter, type LetterLocale } from "@/lib/letters";
import { computeRoundScores } from "@/lib/scoring";
import type { AnswerView, GameState, GameStatus, PlayerView, RoundView, SessionUser } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const ONLINE_MS = 20_000; // clients heartbeat every ~5s via `state`
const HOST_TIMEOUT_MS = 30_000; // hand host to someone else after this long away
const LOBBY_PRUNE_MS = 120_000; // hide long-gone players from the lobby list
const ANSWER_GRACE_MS = 2_000; // accept the final auto-save that races the timer
const REVEAL_SECONDS = 3;
const MAX_ANSWER_LENGTH = 60;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------
interface GameRow {
  id: string;
  instance_id: string;
  status: GameStatus;
  host_user_id: string | null;
  current_round: number;
  used_letters: string[];
  version: number;
}
interface SettingsRow {
  game_id: string;
  round_seconds: number;
  total_rounds: number;
  categories: string[];
  letter_locale: LetterLocale;
  exclude_hard_letters: boolean;
}
interface PlayerRow {
  id: string;
  game_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  is_ready: boolean;
  joined_at: string;
  last_seen_at: string;
}
interface RoundRow {
  id: string;
  game_id: string;
  round_number: number;
  letter: string;
  letter_locale: LetterLocale;
  categories: string[];
  status: "playing" | "voting" | "scored";
  started_at: string;
  ends_at: string;
}
interface AnswerRow {
  id: string;
  round_id: string;
  player_id: string;
  category: string;
  value: string;
  normalized: string;
  auto_valid: boolean;
  host_verdict: boolean | null;
  is_valid: boolean | null;
  points: number;
}
interface VoteRow {
  answer_id: string;
  voter_player_id: string;
  approve: boolean;
}

interface Core {
  game: GameRow;
  settings: SettingsRow;
  players: PlayerRow[];
}
interface Member extends Core {
  me: PlayerRow;
}

type Body = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function check<T>(res: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (res.error) {
    if (res.error.code === "P0001") throw new HttpError(409, res.error.message);
    throw new Error(`${what}: ${res.error.message}`);
  }
  if (res.data === null) throw new HttpError(404, `${what}: not found`);
  return res.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new HttpError(400, `Invalid ${field}`);
  return value;
}
function int(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}
function triState(value: unknown, field: string): boolean | null {
  if (value === null || typeof value === "boolean") return value;
  throw new HttpError(400, `Invalid ${field}`);
}

const isOnline = (p: PlayerRow, now: number) => now - Date.parse(p.last_seen_at) < ONLINE_MS;

async function loadCore(gameId: string): Promise<Core> {
  const db = admin();
  const [game, settings, players] = await Promise.all([
    db.from("games").select("*").eq("id", gameId).maybeSingle<GameRow>(),
    db.from("settings").select("*").eq("game_id", gameId).maybeSingle<SettingsRow>(),
    db.from("players").select("*").eq("game_id", gameId).order("joined_at").returns<PlayerRow[]>(),
  ]);
  return {
    game: check(game, "game"),
    settings: check(settings, "settings"),
    players: check(players, "players"),
  };
}

async function requireMember(user: SessionUser, body: Body): Promise<Member> {
  const core = await loadCore(uuid(body.gameId, "gameId"));
  const me = core.players.find((p) => p.user_id === user.userId);
  if (!me) throw new HttpError(403, "You are not in this game");
  // Any action is proof of life, not only the periodic `state` heartbeat.
  const seenAt = new Date().toISOString();
  const { error } = await admin().from("players").update({ last_seen_at: seenAt }).eq("id", me.id);
  if (error) throw new Error(`heartbeat: ${error.message}`);
  me.last_seen_at = seenAt;
  return { ...core, me };
}

function requireHost(m: Member) {
  if (m.game.host_user_id !== m.me.user_id) throw new HttpError(403, "Only the host can do that");
}

function requireStatus(m: Core, ...statuses: GameStatus[]) {
  if (!statuses.includes(m.game.status)) throw new HttpError(409, `Game is ${m.game.status}`);
}

async function touch(gameId: string) {
  const { error } = await admin().rpc("touch_game", { p_game_id: gameId });
  if (error) throw new Error(`touch_game: ${error.message}`);
}

async function currentRound(game: GameRow): Promise<RoundRow | null> {
  if (game.current_round < 1) return null;
  const res = await admin()
    .from("rounds")
    .select("*")
    .eq("game_id", game.id)
    .eq("round_number", game.current_round)
    .maybeSingle<RoundRow>();
  if (res.error) throw new Error(`round: ${res.error.message}`);
  return res.data;
}

/** Give host to the longest-present online player if the host is missing or away. Returns true if changed. */
async function maybeMigrateHost(core: Core, now: number): Promise<boolean> {
  const { game, players } = core;
  const host = players.find((p) => p.user_id === game.host_user_id);
  const hostGone = !host || now - Date.parse(host.last_seen_at) > HOST_TIMEOUT_MS;
  if (!hostGone) return false;
  const successor = players.find((p) => isOnline(p, now));
  if (!successor || successor.user_id === game.host_user_id) return false;

  let query = admin().from("games").update({ host_user_id: successor.user_id }).eq("id", game.id);
  query = game.host_user_id ? query.eq("host_user_id", game.host_user_id) : query.is("host_user_id", null);
  const { data, error } = await query.select("id");
  if (error) throw new Error(`host migration: ${error.message}`);
  if (data.length > 0) game.host_user_id = successor.user_id;
  return data.length > 0;
}

async function endRoundIfNeeded(round: RoundRow | null, now: number): Promise<boolean> {
  if (!round || round.status !== "playing" || now <= Date.parse(round.ends_at) + ANSWER_GRACE_MS) return false;
  const { error } = await admin().rpc("end_round", { p_round_id: round.id });
  if (error) throw new Error(`end_round: ${error.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// State projection (what each client is allowed to see)
// ---------------------------------------------------------------------------
async function buildState(user: SessionUser, gameId: string): Promise<GameState> {
  const db = admin();
  const { game, settings, players } = await loadCore(gameId);
  const now = Date.now();
  const me = players.find((p) => p.user_id === user.userId);
  if (!me) throw new HttpError(403, "You are not in this game");

  let round: RoundView | null = null;
  const r = game.status === "lobby" ? null : await currentRound(game);
  if (r) {
    const closed = r.status !== "playing";
    const answersQuery = db.from("answers").select("*").eq("round_id", r.id);
    const [subs, answers, votes] = await Promise.all([
      db.from("submissions").select("player_id").eq("round_id", r.id).returns<{ player_id: string }[]>(),
      (closed ? answersQuery : answersQuery.eq("player_id", me.id)).returns<AnswerRow[]>(),
      closed
        ? db
            .from("votes")
            .select("answer_id, voter_player_id, approve, answers!inner(round_id)")
            .eq("answers.round_id", r.id)
            .returns<VoteRow[]>()
        : Promise.resolve({ data: [] as VoteRow[], error: null }),
    ]);
    const answerRows = check(answers, "answers");
    const voteRows = check(votes, "votes");

    const answerViews: AnswerView[] = closed
      ? answerRows.map((a) => {
          const mine = voteRows.filter((v) => v.answer_id === a.id);
          return {
            id: a.id,
            playerId: a.player_id,
            category: a.category,
            value: a.value,
            normalized: a.normalized,
            autoValid: a.auto_valid,
            hostVerdict: a.host_verdict,
            isValid: a.is_valid,
            points: a.points,
            approvals: mine.filter((v) => v.approve).length,
            rejections: mine.filter((v) => !v.approve).length,
            myVote: mine.find((v) => v.voter_player_id === me.id)?.approve ?? null,
          };
        })
      : [];

    round = {
      id: r.id,
      number: r.round_number,
      letter: r.letter,
      letterLocale: r.letter_locale,
      categories: r.categories,
      status: r.status,
      startedAt: Date.parse(r.started_at),
      endsAt: Date.parse(r.ends_at),
      submittedPlayerIds: check(subs, "submissions").map((s) => s.player_id),
      myAnswers: Object.fromEntries(answerRows.filter((a) => a.player_id === me.id).map((a) => [a.category, a.value])),
      answers: answerViews,
      votes: voteRows.map((v) => ({ answerId: v.answer_id, approve: v.approve })),
    };
  }

  const visiblePlayers = players.filter(
    (p) => game.status !== "lobby" || p.id === me.id || now - Date.parse(p.last_seen_at) < LOBBY_PRUNE_MS,
  );

  return {
    serverNow: now,
    game: {
      id: game.id,
      instanceId: game.instance_id,
      status: game.status,
      hostUserId: game.host_user_id,
      currentRound: game.current_round,
      version: game.version,
    },
    me: { playerId: me.id, userId: me.user_id },
    settings: {
      roundSeconds: settings.round_seconds,
      totalRounds: settings.total_rounds,
      categories: settings.categories,
      letterLocale: settings.letter_locale,
      excludeHardLetters: settings.exclude_hard_letters,
    },
    players: visiblePlayers.map<PlayerView>((p) => ({
      id: p.id,
      userId: p.user_id,
      username: p.username,
      avatarUrl: p.avatar_url,
      score: p.score,
      ready: p.is_ready,
      online: isOnline(p, now),
      isHost: p.user_id === game.host_user_id,
    })),
    round,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
type Action = (user: SessionUser, body: Body) => Promise<GameState>;

export const actions: Record<string, Action> = {
  /** Enter (or create) the game bound to this Discord Activity instance. */
  async join(user, body) {
    const instanceId = body.instanceId;
    if (typeof instanceId !== "string" || !/^[\w:-]{1,200}$/.test(instanceId)) {
      throw new HttpError(400, "Invalid instanceId");
    }
    // Guests (local test mode) live in their own namespace and can never enter a real Discord instance.
    const key = user.kind === "guest" ? `guest:${instanceId}` : instanceId;
    const db = admin();

    const created = await db.from("games").upsert({ instance_id: key }, { onConflict: "instance_id", ignoreDuplicates: true });
    if (created.error) throw new Error(`create game: ${created.error.message}`);
    const game = check(await db.from("games").select("*").eq("instance_id", key).maybeSingle<GameRow>(), "game");

    const [settingsRes, playerRes] = await Promise.all([
      db.from("settings").upsert({ game_id: game.id }, { onConflict: "game_id", ignoreDuplicates: true }),
      db.from("players").upsert(
        {
          game_id: game.id,
          user_id: user.userId,
          username: user.username.slice(0, 64),
          avatar_url: user.avatarUrl,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "game_id,user_id" },
      ),
    ]);
    if (settingsRes.error) throw new Error(`settings: ${settingsRes.error.message}`);
    if (playerRes.error) throw new Error(`player: ${playerRes.error.message}`);

    await maybeMigrateHost(await loadCore(game.id), Date.now());
    await touch(game.id);
    return buildState(user, game.id);
  },

  /** Fetch state. Doubles as heartbeat and as the server-side timer / host-failover tick. */
  async state(user, body) {
    const gameId = uuid(body.gameId, "gameId");
    const db = admin();
    const seen = await db
      .from("players")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("game_id", gameId)
      .eq("user_id", user.userId)
      .select("id");
    if (seen.error) throw new Error(`heartbeat: ${seen.error.message}`);
    if (seen.data.length === 0) throw new HttpError(403, "You are not in this game");

    const core = await loadCore(gameId);
    const now = Date.now();
    const hostChanged = await maybeMigrateHost(core, now);
    const ended = core.game.status === "playing" && (await endRoundIfNeeded(await currentRound(core.game), now));
    if (hostChanged && !ended) await touch(gameId);
    return buildState(user, gameId);
  },

  async settings(user, body) {
    const m = await requireMember(user, body);
    requireHost(m);
    requireStatus(m, "lobby");
    const patch = (body.patch ?? {}) as Body;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (patch.roundSeconds !== undefined) update.round_seconds = int(patch.roundSeconds, "roundSeconds", 10, 300);
    if (patch.totalRounds !== undefined) update.total_rounds = int(patch.totalRounds, "totalRounds", 1, 20);
    if (patch.letterLocale !== undefined) {
      if (patch.letterLocale !== "en" && patch.letterLocale !== "ar") throw new HttpError(400, "Invalid letterLocale");
      update.letter_locale = patch.letterLocale;
    }
    if (patch.excludeHardLetters !== undefined) {
      if (typeof patch.excludeHardLetters !== "boolean") throw new HttpError(400, "Invalid excludeHardLetters");
      update.exclude_hard_letters = patch.excludeHardLetters;
    }
    if (patch.categories !== undefined) {
      const list = patch.categories;
      if (!Array.isArray(list) || list.some((c) => typeof c !== "string" || !CATEGORY_IDS.includes(c))) {
        throw new HttpError(400, "Invalid categories");
      }
      const unique = CATEGORY_IDS.filter((id) => list.includes(id)); // canonical order, deduped
      if (unique.length === 0) throw new HttpError(400, "Select at least one category");
      update.categories = unique;
    }

    const { error } = await admin().from("settings").update(update).eq("game_id", m.game.id);
    if (error) throw new Error(`settings: ${error.message}`);
    await touch(m.game.id);
    return buildState(user, m.game.id);
  },

  async ready(user, body) {
    const m = await requireMember(user, body);
    requireStatus(m, "lobby");
    if (typeof body.ready !== "boolean") throw new HttpError(400, "Invalid ready");
    const { error } = await admin().from("players").update({ is_ready: body.ready }).eq("id", m.me.id);
    if (error) throw new Error(`ready: ${error.message}`);
    await touch(m.game.id);
    return buildState(user, m.game.id);
  },

  async start(user, body) {
    const m = await requireMember(user, body);
    requireHost(m);
    requireStatus(m, "lobby");
    const letter = pickLetter(m.settings.letter_locale, [], m.settings.exclude_hard_letters);
    const { data, error } = await admin().rpc("start_round", {
      p_game_id: m.game.id,
      p_expected_status: "lobby",
      p_letter: letter,
      p_reveal_seconds: REVEAL_SECONDS,
    });
    if (error) throw new Error(`start_round: ${error.message}`);
    if (!data) throw new HttpError(409, "Game already started");
    return buildState(user, m.game.id);
  },

  /** From the round results: start the next round, or show the final leaderboard after the last one. */
  async next(user, body) {
    const m = await requireMember(user, body);
    requireHost(m);
    requireStatus(m, "results");
    const db = admin();

    if (m.game.current_round >= m.settings.total_rounds) {
      const { error } = await db.from("games").update({ status: "finished" }).eq("id", m.game.id).eq("status", "results");
      if (error) throw new Error(`finish: ${error.message}`);
      await touch(m.game.id);
      return buildState(user, m.game.id);
    }

    const letter = pickLetter(m.settings.letter_locale, m.game.used_letters, m.settings.exclude_hard_letters);
    const { error } = await db.rpc("start_round", {
      p_game_id: m.game.id,
      p_expected_status: "results",
      p_letter: letter,
      p_reveal_seconds: REVEAL_SECONDS,
    });
    if (error) throw new Error(`start_round: ${error.message}`);
    return buildState(user, m.game.id);
  },

  /** Auto-save drafts while typing; `submit: true` locks the player in ("Done"). */
  async answers(user, body) {
    const m = await requireMember(user, body);
    requireStatus(m, "playing");
    const round = await currentRound(m.game);
    if (!round || round.id !== uuid(body.roundId, "roundId") || round.status !== "playing") {
      throw new HttpError(409, "Round is closed");
    }
    const now = Date.now();
    if (now > Date.parse(round.ends_at) + ANSWER_GRACE_MS) throw new HttpError(409, "Time is up");

    const db = admin();
    const submitted = await db.from("submissions").select("player_id").eq("round_id", round.id).returns<{ player_id: string }[]>();
    const submittedIds = new Set(check(submitted, "submissions").map((s) => s.player_id));
    if (submittedIds.has(m.me.id)) return buildState(user, m.game.id); // already locked in

    const input = (body.answers ?? {}) as Record<string, unknown>;
    const rows = round.categories.map((category) => {
      const value = String(input[category] ?? "")
        .replace(/[ -]/g, "")
        .trim()
        .slice(0, MAX_ANSWER_LENGTH);
      const normalized = normalizeAnswer(value);
      return {
        round_id: round.id,
        player_id: m.me.id,
        category,
        value,
        normalized,
        auto_valid: startsWithLetter(normalized, round.letter),
      };
    });
    const saved = await db.from("answers").upsert(rows, { onConflict: "round_id,player_id,category" });
    if (saved.error) {
      if (saved.error.code === "P0001") throw new HttpError(409, "Round is closed");
      throw new Error(`answers: ${saved.error.message}`);
    }

    if (body.submit === true) {
      const sub = await db
        .from("submissions")
        .upsert({ round_id: round.id, player_id: m.me.id }, { onConflict: "round_id,player_id", ignoreDuplicates: true });
      if (sub.error) throw new Error(`submit: ${sub.error.message}`);
      submittedIds.add(m.me.id);

      const everyoneDone = m.players.filter((p) => p.id === m.me.id || isOnline(p, now)).every((p) => submittedIds.has(p.id));
      if (everyoneDone) {
        const { error } = await db.rpc("end_round", { p_round_id: round.id });
        if (error) throw new Error(`end_round: ${error.message}`);
      } else {
        await touch(m.game.id);
      }
    }
    return buildState(user, m.game.id);
  },

  async endRound(user, body) {
    const m = await requireMember(user, body);
    requireHost(m);
    requireStatus(m, "playing");
    const round = await currentRound(m.game);
    if (round) {
      const { error } = await admin().rpc("end_round", { p_round_id: round.id });
      if (error) throw new Error(`end_round: ${error.message}`);
    }
    return buildState(user, m.game.id);
  },

  /** approve: true (👍), false (👎) or null (clear). You can't vote on your own answer. */
  async vote(user, body) {
    const m = await requireMember(user, body);
    requireStatus(m, "voting");
    const answer = await votableAnswer(m, body);
    if (answer.player_id === m.me.id) throw new HttpError(400, "You can't vote on your own answer");
    const approve = triState(body.approve, "approve");
    const db = admin();
    const res =
      approve === null
        ? await db.from("votes").delete().eq("answer_id", answer.id).eq("voter_player_id", m.me.id)
        : await db
            .from("votes")
            .upsert({ answer_id: answer.id, voter_player_id: m.me.id, approve }, { onConflict: "answer_id,voter_player_id" });
    if (res.error) throw new Error(`vote: ${res.error.message}`);
    await touch(m.game.id);
    return buildState(user, m.game.id);
  },

  /** Host dispute resolution: force an answer valid/invalid, or null to let the vote decide. */
  async verdict(user, body) {
    const m = await requireMember(user, body);
    requireHost(m);
    requireStatus(m, "voting");
    const answer = await votableAnswer(m, body);
    const verdict = triState(body.verdict, "verdict");
    const { error } = await admin().from("answers").update({ host_verdict: verdict }).eq("id", answer.id);
    if (error) throw new Error(`verdict: ${error.message}`);
    await touch(m.game.id);
    return buildState(user, m.game.id);
  },

  /** Lock votes and apply scores. */
  async tally(user, body) {
    const m = await requireMember(user, body);
    requireHost(m);
    requireStatus(m, "voting");
    const round = await currentRound(m.game);
    if (!round) throw new HttpError(409, "No round to score");
    const db = admin();
    const [answers, votes] = await Promise.all([
      db.from("answers").select("*").eq("round_id", round.id).returns<AnswerRow[]>(),
      db
        .from("votes")
        .select("answer_id, voter_player_id, approve, answers!inner(round_id)")
        .eq("answers.round_id", round.id)
        .returns<VoteRow[]>(),
    ]);
    const scores = computeRoundScores(
      check(answers, "answers").map((a) => ({
        id: a.id,
        playerId: a.player_id,
        category: a.category,
        normalized: a.normalized,
        autoValid: a.auto_valid,
        hostVerdict: a.host_verdict,
      })),
      check(votes, "votes").map((v) => ({ answerId: v.answer_id, approve: v.approve })),
    );
    const { error } = await db.rpc("apply_round_scores", {
      p_round_id: round.id,
      p_results: scores.map((s) => ({ id: s.id, is_valid: s.isValid, points: s.points })),
    });
    if (error) throw new Error(`apply_round_scores: ${error.message}`);
    return buildState(user, m.game.id);
  },

  /** "Play again" from the leaderboard, or the host ending a game early. Settings are kept. */
  async lobby(user, body) {
    const m = await requireMember(user, body);
    requireHost(m);
    if (m.game.status === "lobby") return buildState(user, m.game.id);
    const db = admin();
    const [g, p] = await Promise.all([
      db.from("games").update({ status: "lobby", current_round: 0, used_letters: [] }).eq("id", m.game.id),
      db.from("players").update({ is_ready: false }).eq("game_id", m.game.id),
    ]);
    if (g.error) throw new Error(`lobby: ${g.error.message}`);
    if (p.error) throw new Error(`lobby players: ${p.error.message}`);
    await touch(m.game.id);
    return buildState(user, m.game.id);
  },
};

async function votableAnswer(m: Member, body: Body): Promise<AnswerRow> {
  const answerId = uuid(body.answerId, "answerId");
  const round = await currentRound(m.game);
  const res = await admin().from("answers").select("*").eq("id", answerId).maybeSingle<AnswerRow>();
  const answer = check(res, "answer");
  if (!round || answer.round_id !== round.id) throw new HttpError(409, "Answer is not in the current round");
  if (!answer.normalized) throw new HttpError(400, "Blank answers can't be voted on");
  return answer;
}

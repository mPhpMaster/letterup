-- =============================================================================
-- Social layer: player profiles with lifetime stats, an in-app follow graph,
-- room codes for browser play, room invites, and host kicks.
--
-- Discord's API does not expose a user's friend list to apps, so "following"
-- lives here and only ever links people who have met in a LetterUp game.
-- Same security model as the base schema: every write goes through the API with
-- the service role; browsers may only read the `games` row for Realtime.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: one row per Discord (or guest) user, across all games
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id       text primary key,
  username      text not null,
  avatar_url    text,
  games_played  int not null default 0,
  wins          int not null default 0,
  rounds_played int not null default 0,
  total_points  int not null default 0,
  best_score    int not null default 0,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- -----------------------------------------------------------------------------
-- follows: directed, in-app only
-- -----------------------------------------------------------------------------
create table public.follows (
  follower_id text not null references public.profiles (user_id) on delete cascade,
  followee_id text not null references public.profiles (user_id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

-- -----------------------------------------------------------------------------
-- room_invites: "come play with me" pings between people who follow each other
-- -----------------------------------------------------------------------------
create table public.room_invites (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games (id) on delete cascade,
  from_user_id text not null,
  to_user_id   text not null,
  created_at   timestamptz not null default now(),
  unique (game_id, to_user_id)
);
create index room_invites_to_idx on public.room_invites (to_user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- games: short join code + where the room came from
-- -----------------------------------------------------------------------------
alter table public.games add column room_code text unique;
alter table public.games add column origin text not null default 'discord'
  check (origin in ('discord', 'web'));

-- -----------------------------------------------------------------------------
-- players: host can remove someone from the lobby
-- -----------------------------------------------------------------------------
alter table public.players add column kicked_at timestamptz;

-- -----------------------------------------------------------------------------
-- RPC: record lifetime stats when a game reaches the final leaderboard.
-- Idempotent per game via games.stats_recorded_at.
-- -----------------------------------------------------------------------------
alter table public.games add column stats_recorded_at timestamptz;

create or replace function public.record_game_stats(p_game_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_rounds int;
  v_top int;
begin
  update games set stats_recorded_at = now()
   where id = p_game_id and stats_recorded_at is null;
  if not found then
    return false;
  end if;

  select count(*) into v_rounds from rounds where game_id = p_game_id and status = 'scored';
  select coalesce(max(score), 0) into v_top from players where game_id = p_game_id and kicked_at is null;

  insert into profiles (user_id, username, avatar_url, games_played, wins, rounds_played, total_points, best_score)
  select p.user_id,
         p.username,
         p.avatar_url,
         1,
         case when p.score = v_top and v_top > 0 then 1 else 0 end,
         v_rounds,
         p.score,
         p.score
    from players p
   where p.game_id = p_game_id and p.kicked_at is null
  on conflict (user_id) do update
    set games_played  = profiles.games_played + 1,
        wins          = profiles.wins + excluded.wins,
        rounds_played = profiles.rounds_played + excluded.rounds_played,
        total_points  = profiles.total_points + excluded.total_points,
        best_score    = greatest(profiles.best_score, excluded.best_score),
        username      = excluded.username,
        avatar_url    = excluded.avatar_url;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Housekeeping: invites disappear with their game; drop stale ones early
-- -----------------------------------------------------------------------------
create or replace function public.cleanup_stale_invites()
returns int
language sql
set search_path = public
as $$
  with deleted as (
    delete from room_invites where created_at < now() - interval '2 hours' returning 1
  )
  select count(*)::int from deleted;
$$;

-- =============================================================================
-- Row Level Security: server-only, like the rest of the schema
-- =============================================================================
alter table public.profiles     enable row level security;
alter table public.follows      enable row level security;
alter table public.room_invites enable row level security;

revoke all on public.profiles, public.follows, public.room_invites from anon, authenticated;

revoke execute on function public.record_game_stats(uuid) from public, anon, authenticated;
revoke execute on function public.cleanup_stale_invites() from public, anon, authenticated;
grant execute on function public.record_game_stats(uuid) to service_role;
grant execute on function public.cleanup_stale_invites() to service_role;

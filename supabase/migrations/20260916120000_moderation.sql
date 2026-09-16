-- =============================================================================
-- Moderation and discovery: suggestions, reports, bans, room passwords and a
-- public room list. Admin-only data is never exposed to normal players: the API
-- checks ADMIN_USER_IDS before reading suggestions or reports.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bans live on the profile so every entry point can check them cheaply
-- -----------------------------------------------------------------------------
alter table public.profiles add column banned_at  timestamptz;
alter table public.profiles add column ban_reason text;
alter table public.profiles add column banned_by  text;

-- -----------------------------------------------------------------------------
-- suggestions: "send feedback" from the home screen, readable by admins only
-- -----------------------------------------------------------------------------
create table public.suggestions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  username   text not null,
  body       text not null check (char_length(body) between 3 and 2000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index suggestions_created_idx on public.suggestions (created_at desc);

-- -----------------------------------------------------------------------------
-- reports: raised from a player's profile or the leaderboard, admins only
-- -----------------------------------------------------------------------------
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      text not null,
  reporter_name    text not null,
  reported_user_id text not null,
  reported_name    text not null,
  reason           text not null check (char_length(reason) between 3 and 1000),
  created_at       timestamptz not null default now(),
  handled_at       timestamptz
);
create index reports_created_idx on public.reports (created_at desc);
create index reports_target_idx on public.reports (reported_user_id);

-- -----------------------------------------------------------------------------
-- Rooms can be password protected; locked rooms still appear in the list
-- -----------------------------------------------------------------------------
alter table public.games add column password_hash text;

-- -----------------------------------------------------------------------------
-- RPC: the browser home screen's room list (server-side only)
-- -----------------------------------------------------------------------------
create or replace function public.list_rooms(p_limit int default 30)
returns table (
  room_code     text,
  status        text,
  current_round int,
  total_rounds  int,
  player_count  int,
  has_password  boolean,
  host_username text,
  updated_at    timestamptz
)
language sql
stable
set search_path = public
as $$
  select g.room_code,
         g.status,
         g.current_round,
         s.total_rounds,
         (select count(*)::int
            from players p
           where p.game_id = g.id
             and p.kicked_at is null
             and p.last_seen_at > now() - interval '90 seconds'),
         g.password_hash is not null,
         (select p.username from players p where p.game_id = g.id and p.user_id = g.host_user_id limit 1),
         g.updated_at
    from games g
    join settings s on s.game_id = g.id
   where g.origin = 'web'
     and g.room_code is not null
     and g.status <> 'finished'
     and g.updated_at > now() - interval '30 minutes'
   order by g.updated_at desc
   limit greatest(1, least(p_limit, 50));
$$;

-- -----------------------------------------------------------------------------
-- RPC: global leaderboard — most points, then most wins. Banned players hidden.
-- -----------------------------------------------------------------------------
create or replace function public.leaderboard(p_limit int default 50)
returns table (
  user_id       text,
  username      text,
  avatar_url    text,
  total_points  int,
  wins          int,
  games_played  int,
  rounds_played int,
  best_score    int,
  last_seen_at  timestamptz
)
language sql
stable
set search_path = public
as $$
  select p.user_id, p.username, p.avatar_url, p.total_points, p.wins,
         p.games_played, p.rounds_played, p.best_score, p.last_seen_at
    from profiles p
   where p.banned_at is null and p.games_played > 0
   order by p.total_points desc, p.wins desc, p.games_played asc
   limit greatest(1, least(p_limit, 100));
$$;

-- =============================================================================
-- Row Level Security: server-only, like the rest of the schema
-- =============================================================================
alter table public.suggestions enable row level security;
alter table public.reports     enable row level security;

revoke all on public.suggestions, public.reports from anon, authenticated;

revoke execute on function public.list_rooms(int) from public, anon, authenticated;
revoke execute on function public.leaderboard(int) from public, anon, authenticated;
grant execute on function public.list_rooms(int) to service_role;
grant execute on function public.leaderboard(int) to service_role;

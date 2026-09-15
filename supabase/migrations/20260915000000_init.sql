-- =============================================================================
-- Human, Animal, Plant, Object — Discord Activity schema
--
-- Security model
--   * Every write goes through the Next.js API (/api/game/*), which verifies the
--     caller's Discord identity (OAuth2 code exchange -> signed session token)
--     and then talks to Postgres with the service-role key.
--   * Browsers only hold the anon/publishable key. RLS is enabled on every table;
--     the only thing anon may read is the `games` row (status + version counter),
--     which is what Supabase Realtime broadcasts as a "something changed" signal.
--     Answers are therefore never readable by other players while a round runs.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- games: one row per Discord Activity instance (voice channel session)
-- -----------------------------------------------------------------------------
create table public.games (
  id            uuid primary key default gen_random_uuid(),
  instance_id   text not null unique,
  status        text not null default 'lobby'
                check (status in ('lobby', 'playing', 'voting', 'results', 'finished')),
  host_user_id  text,
  current_round int not null default 0,
  used_letters  text[] not null default '{}',
  version       bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- settings: host-configurable, locked once the game starts
-- -----------------------------------------------------------------------------
create table public.settings (
  game_id              uuid primary key references public.games (id) on delete cascade,
  round_seconds        int not null default 60 check (round_seconds between 10 and 300),
  total_rounds         int not null default 5 check (total_rounds between 1 and 20),
  categories           text[] not null default array['human', 'animal', 'plant', 'object'],
  letter_locale        text not null default 'en' check (letter_locale in ('en', 'ar')),
  exclude_hard_letters boolean not null default true,
  updated_at           timestamptz not null default now(),
  constraint settings_has_category check (cardinality(categories) >= 1)
);

-- -----------------------------------------------------------------------------
-- players: Discord users who opened the activity in this instance
-- -----------------------------------------------------------------------------
create table public.players (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games (id) on delete cascade,
  user_id      text not null,             -- Discord user id (or guest id in local dev)
  username     text not null,
  avatar_url   text,
  score        int not null default 0,
  is_ready     boolean not null default false,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (game_id, user_id)
);
create index players_game_id_idx on public.players (game_id);

-- -----------------------------------------------------------------------------
-- rounds: letter + timing are decided server-side
-- -----------------------------------------------------------------------------
create table public.rounds (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games (id) on delete cascade,
  round_number  int not null,
  letter        text not null,
  letter_locale text not null check (letter_locale in ('en', 'ar')),
  categories    text[] not null,
  status        text not null default 'playing' check (status in ('playing', 'voting', 'scored')),
  started_at    timestamptz not null,       -- answers open (after the "get ready" reveal)
  ends_at       timestamptz not null,       -- server-authoritative deadline
  ended_at      timestamptz,
  unique (game_id, round_number)
);

-- -----------------------------------------------------------------------------
-- submissions: a player pressed "Done" for a round
-- -----------------------------------------------------------------------------
create table public.submissions (
  round_id     uuid not null references public.rounds (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- -----------------------------------------------------------------------------
-- answers: one per player per category per round
-- -----------------------------------------------------------------------------
create table public.answers (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  category     text not null,
  value        text not null default '' check (char_length(value) <= 60),
  normalized   text not null default '',
  auto_valid   boolean not null default false,  -- non-blank and starts with the letter
  host_verdict boolean,                         -- host override (null = none)
  is_valid     boolean,                         -- final verdict, set when scored
  points       int not null default 0,
  updated_at   timestamptz not null default now(),
  unique (round_id, player_id, category)
);
create index answers_round_id_idx on public.answers (round_id);

-- -----------------------------------------------------------------------------
-- votes: thumbs up / down from other players
-- -----------------------------------------------------------------------------
create table public.votes (
  answer_id       uuid not null references public.answers (id) on delete cascade,
  voter_player_id uuid not null references public.players (id) on delete cascade,
  approve         boolean not null,
  created_at      timestamptz not null default now(),
  primary key (answer_id, voter_player_id)
);

-- -----------------------------------------------------------------------------
-- Guard: answer text can only change while its round is still being played.
-- -----------------------------------------------------------------------------
create or replace function public.answers_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.value is distinct from old.value then
    if not exists (select 1 from rounds r where r.id = new.round_id and r.status = 'playing') then
      raise exception 'round is closed' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger answers_guard
before insert or update on public.answers
for each row execute function public.answers_guard();

-- -----------------------------------------------------------------------------
-- RPC: bump the version counter so Realtime notifies every client
-- -----------------------------------------------------------------------------
create or replace function public.touch_game(p_game_id uuid)
returns void
language sql
set search_path = public
as $$
  update games set version = version + 1, updated_at = now() where id = p_game_id;
$$;

-- -----------------------------------------------------------------------------
-- RPC: start the next round atomically (guards against double clicks / races)
--   p_expected_status: 'lobby' starts a fresh game, 'results' starts the next round
-- -----------------------------------------------------------------------------
create or replace function public.start_round(
  p_game_id uuid,
  p_expected_status text,
  p_letter text,
  p_reveal_seconds int default 3
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  g games;
  s settings;
  v_number int;
  v_round_id uuid;
begin
  select * into g from games where id = p_game_id for update;
  if not found or g.status <> p_expected_status then
    return null;
  end if;
  select * into s from settings where game_id = p_game_id;

  if p_expected_status = 'lobby' then
    delete from rounds where game_id = p_game_id;
    update players set score = 0, is_ready = false where game_id = p_game_id;
    v_number := 1;
  else
    if g.current_round >= s.total_rounds then
      return null;
    end if;
    v_number := g.current_round + 1;
  end if;

  insert into rounds (game_id, round_number, letter, letter_locale, categories, started_at, ends_at)
  values (
    p_game_id, v_number, p_letter, s.letter_locale, s.categories,
    now() + make_interval(secs => p_reveal_seconds),
    now() + make_interval(secs => p_reveal_seconds + s.round_seconds)
  )
  returning id into v_round_id;

  update games
     set status        = 'playing',
         current_round = v_number,
         used_letters  = case when p_expected_status = 'lobby' then array[p_letter]
                              else array_append(used_letters, p_letter) end,
         version       = version + 1,
         updated_at    = now()
   where id = p_game_id;

  return v_round_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: close a round (timer expired, everyone submitted, or host ended it)
-- -----------------------------------------------------------------------------
create or replace function public.end_round(p_round_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  update rounds set status = 'voting', ended_at = now()
   where id = p_round_id and status = 'playing'
  returning game_id into v_game_id;

  if v_game_id is null then
    return false;
  end if;

  update games set status = 'voting', version = version + 1, updated_at = now()
   where id = v_game_id and status = 'playing';
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: persist scores computed by the app (src/lib/scoring.ts) atomically
--   p_results: [{ "id": uuid, "is_valid": bool, "points": int }, ...]
-- -----------------------------------------------------------------------------
create or replace function public.apply_round_scores(p_round_id uuid, p_results jsonb)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  update rounds set status = 'scored'
   where id = p_round_id and status = 'voting'
  returning game_id into v_game_id;

  if v_game_id is null then
    return false;
  end if;

  update answers a
     set is_valid = r.is_valid,
         points   = r.points
    from jsonb_to_recordset(p_results) as r (id uuid, is_valid boolean, points int)
   where a.id = r.id and a.round_id = p_round_id;

  -- Recompute totals from scratch so the operation is idempotent
  update players p
     set score = coalesce((
           select sum(a.points)
             from answers a
             join rounds rd on rd.id = a.round_id
            where rd.game_id = v_game_id and a.player_id = p.id
         ), 0)
   where p.game_id = v_game_id;

  update games set status = 'results', version = version + 1, updated_at = now()
   where id = v_game_id;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Housekeeping: remove games idle for more than a day
-- (schedule with pg_cron:  select cron.schedule('cleanup-games', '0 * * * *', 'select public.cleanup_stale_games()');)
-- -----------------------------------------------------------------------------
create or replace function public.cleanup_stale_games()
returns int
language sql
set search_path = public
as $$
  with deleted as (
    delete from games where updated_at < now() - interval '1 day' returning 1
  )
  select count(*)::int from deleted;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.games       enable row level security;
alter table public.settings    enable row level security;
alter table public.players     enable row level security;
alter table public.rounds      enable row level security;
alter table public.submissions enable row level security;
alter table public.answers     enable row level security;
alter table public.votes       enable row level security;

-- Clients may read the lightweight game row (needed for Realtime change events).
-- It contains no answers or personal data beyond the host's Discord id.
create policy "games: realtime signal is readable"
  on public.games for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies exist for anon/authenticated on any table:
-- all mutations are performed by the API with the service role after verifying
-- the Discord session. Defence in depth: strip table privileges as well.
revoke insert, update, delete, truncate on public.games from anon, authenticated;
revoke all on public.settings, public.players, public.rounds,
              public.submissions, public.answers, public.votes
  from anon, authenticated;

-- RPCs are server-only
revoke execute on function public.touch_game(uuid) from public, anon, authenticated;
revoke execute on function public.start_round(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public.end_round(uuid) from public, anon, authenticated;
revoke execute on function public.apply_round_scores(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.cleanup_stale_games() from public, anon, authenticated;
grant execute on function public.touch_game(uuid) to service_role;
grant execute on function public.start_round(uuid, text, text, int) to service_role;
grant execute on function public.end_round(uuid) to service_role;
grant execute on function public.apply_round_scores(uuid, jsonb) to service_role;
grant execute on function public.cleanup_stale_games() to service_role;

-- =============================================================================
-- Realtime: broadcast changes to the games row
-- =============================================================================
alter publication supabase_realtime add table public.games;

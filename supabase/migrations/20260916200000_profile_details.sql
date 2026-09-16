-- =============================================================================
-- Detailed profile stats: the history behind the redesigned profile card.
--
-- Games are deleted a day after they go idle (cleanup_stale_games), so anything
-- the profile wants to show later has to be copied out when a game finishes:
--   * game_results            one row per player per finished game (trend, streaks,
--                             1v1 vs group record, shared wins)
--   * profile_category_stats  per-category attempts and accepted answers (mastery)
--   * profile_words           every distinct accepted word (vocabulary, longest word,
--                             letter fingerprint)
--   * profiles counters       rounds completed, answer speed, last-seconds pressure
--
-- Only games finished after this migration are counted; nothing is back-filled,
-- because the rounds and answers of older games are already gone.
-- =============================================================================

alter table public.games add column if not exists details_recorded_at timestamptz;

alter table public.profiles
  add column if not exists detail_rounds     int    not null default 0, -- scored rounds seen by record_game_details
  add column if not exists rounds_complete   int    not null default 0, -- ...of which every category had an answer
  add column if not exists submit_count      int    not null default 0, -- rounds finished by pressing Done
  add column if not exists submit_ms_total   bigint not null default 0, -- time from answers opening to Done, summed
  add column if not exists fastest_submit_ms int,
  add column if not exists pressure_rounds   int    not null default 0, -- Done in the last 5s, or the clock ran out
  add column if not exists answers_given     int    not null default 0, -- non-blank answers
  add column if not exists valid_answers     int    not null default 0; -- answers that scored as valid

create table if not exists public.game_results (
  id          bigint generated always as identity primary key,
  user_id     text not null references public.profiles (user_id) on delete cascade,
  game_id     uuid not null,          -- no FK: the game row is cleaned up later
  finished_at timestamptz not null default now(),
  score       int not null,
  place       int not null,           -- 1 = top score (shared places allowed)
  players     int not null,
  won         boolean not null,       -- sole top score
  tied        boolean not null,       -- top score shared with someone else
  rounds      int not null,
  unique (user_id, game_id)
);
create index if not exists game_results_user_idx on public.game_results (user_id, finished_at desc);

create table if not exists public.profile_category_stats (
  user_id  text not null references public.profiles (user_id) on delete cascade,
  category text not null,
  answered int not null default 0,    -- rounds the category was played in
  valid    int not null default 0,    -- ...where the answer scored as valid
  primary key (user_id, category)
);

create table if not exists public.profile_words (
  user_id       text not null references public.profiles (user_id) on delete cascade,
  word          text not null,        -- normalized form, the uniqueness key
  value         text not null,        -- as first typed, for "longest word"
  letter        text not null,        -- the round's letter
  length        int generated always as (char_length(value)) stored,
  first_used_at timestamptz not null default now(),
  primary key (user_id, word)
);
create index if not exists profile_words_length_idx on public.profile_words (user_id, length desc);

-- -----------------------------------------------------------------------------
-- RPC: copy a finished game's details into the tables above. Runs once per game
-- (details_recorded_at), right after record_game_stats has upserted the profiles.
-- -----------------------------------------------------------------------------
create or replace function public.record_game_details(p_game_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_players   int;
  v_top       int;
  v_top_count int;
  v_rounds    int;
begin
  update games set details_recorded_at = now()
   where id = p_game_id and details_recorded_at is null;
  if not found then
    return false;
  end if;

  select count(*), coalesce(max(score), 0)
    into v_players, v_top
    from players
   where game_id = p_game_id and kicked_at is null and left_at is null;
  select count(*) into v_top_count
    from players
   where game_id = p_game_id and kicked_at is null and left_at is null and score = v_top;
  select count(*) into v_rounds from rounds where game_id = p_game_id and status = 'scored';

  -- Per-game result ----------------------------------------------------------
  insert into game_results (user_id, game_id, score, place, players, won, tied, rounds)
  select p.user_id,
         p_game_id,
         p.score,
         1 + (select count(*)
                from players q
               where q.game_id = p_game_id and q.kicked_at is null and q.left_at is null
                 and q.score > p.score),
         v_players,
         v_top > 0 and p.score = v_top and v_top_count = 1,
         v_top > 0 and p.score = v_top and v_top_count > 1,
         v_rounds
    from players p
    join profiles pr on pr.user_id = p.user_id
   where p.game_id = p_game_id and p.kicked_at is null and p.left_at is null
  on conflict (user_id, game_id) do nothing;

  -- Category mastery ---------------------------------------------------------
  insert into profile_category_stats (user_id, category, answered, valid)
  select p.user_id,
         case when a.category = 'city' then 'country' else a.category end,
         count(*),
         count(*) filter (where a.is_valid)
    from answers a
    join rounds r   on r.id = a.round_id and r.status = 'scored'
    join players p  on p.id = a.player_id and p.kicked_at is null and p.left_at is null
    join profiles pr on pr.user_id = p.user_id
   where r.game_id = p_game_id
   group by 1, 2
  on conflict (user_id, category) do update
    set answered = profile_category_stats.answered + excluded.answered,
        valid    = profile_category_stats.valid + excluded.valid;

  -- Vocabulary: distinct accepted words ----------------------------------------
  insert into profile_words (user_id, word, value, letter)
  select distinct on (p.user_id, a.normalized)
         p.user_id, a.normalized, a.value, r.letter
    from answers a
    join rounds r   on r.id = a.round_id and r.status = 'scored'
    join players p  on p.id = a.player_id and p.kicked_at is null and p.left_at is null
    join profiles pr on pr.user_id = p.user_id
   where r.game_id = p_game_id and a.is_valid and a.normalized <> ''
   order by p.user_id, a.normalized, char_length(a.value) desc
  on conflict (user_id, word) do nothing;

  -- Rounds, speed and answer counters ------------------------------------------
  update profiles pf
     set detail_rounds     = pf.detail_rounds + x.rounds,
         rounds_complete   = pf.rounds_complete + x.complete_rounds,
         submit_count      = pf.submit_count + x.submits,
         submit_ms_total   = pf.submit_ms_total + x.submit_ms,
         fastest_submit_ms = least(pf.fastest_submit_ms, x.fastest_ms),
         pressure_rounds   = pf.pressure_rounds + x.pressure,
         answers_given     = pf.answers_given + x.given,
         valid_answers     = pf.valid_answers + x.valid
    from (
      select pr.user_id,
             count(*)::int                                                     as rounds,
             count(*) filter (where pr.filled >= pr.category_count)::int       as complete_rounds,
             count(pr.submitted_at)::int                                       as submits,
             coalesce(sum(pr.submit_ms), 0)::bigint                            as submit_ms,
             min(pr.submit_ms)::int                                            as fastest_ms,
             count(*) filter (where pr.submitted_at is null
                                 or pr.submitted_at > pr.ends_at - interval '5 seconds')::int as pressure,
             sum(pr.filled)::int                                               as given,
             sum(pr.valid)::int                                                as valid
        from (
          select p.user_id,
                 coalesce(array_length(r.categories, 1), 0) as category_count,
                 (select count(*) from answers a
                   where a.round_id = r.id and a.player_id = p.id and a.normalized <> '') as filled,
                 (select count(*) from answers a
                   where a.round_id = r.id and a.player_id = p.id and a.is_valid) as valid,
                 s.submitted_at,
                 r.ends_at,
                 case when s.submitted_at is not null
                      then greatest(0, extract(epoch from (s.submitted_at - r.started_at)) * 1000)
                 end as submit_ms
            from players p
            join rounds r on r.game_id = p.game_id and r.status = 'scored'
            left join submissions s on s.round_id = r.id and s.player_id = p.id
           where p.game_id = p_game_id and p.kicked_at is null and p.left_at is null
        ) pr
       group by pr.user_id
    ) x
   where pf.user_id = x.user_id;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Server-only, like everything else
-- -----------------------------------------------------------------------------
alter table public.game_results           enable row level security;
alter table public.profile_category_stats enable row level security;
alter table public.profile_words          enable row level security;

revoke all on public.game_results, public.profile_category_stats, public.profile_words from anon, authenticated;

revoke execute on function public.record_game_details(uuid) from public, anon, authenticated;
grant execute on function public.record_game_details(uuid) to service_role;

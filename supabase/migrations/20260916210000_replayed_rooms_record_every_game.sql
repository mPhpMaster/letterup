-- =============================================================================
-- A room is played again and again ("Play Again" returns the same games row to the
-- lobby), so game_results can hold several rows per player per game id. The unique
-- (user_id, game_id) key made every game after a room's first one conflict and be
-- skipped. Drop it; record_game_details already runs once per finish, guarded by
-- games.details_recorded_at, which returning to the lobby now clears.
-- =============================================================================

alter table public.game_results drop constraint if exists game_results_user_id_game_id_key;
create index if not exists game_results_game_idx on public.game_results (game_id);

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
   where p.game_id = p_game_id and p.kicked_at is null and p.left_at is null;

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

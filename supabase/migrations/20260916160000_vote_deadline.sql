-- =============================================================================
-- Voting settles itself when the clock runs out.
--
-- Scoring used to wait on the host pressing "Confirm Scores", which stalled the
-- whole room if they were distracted or had closed the tab. The round now
-- carries a voting deadline and the server tallies it once that passes; the
-- host's button stays as a way to finish early.
--
-- The window is five seconds per player present, as asked. That is deliberately
-- short -- two players get ten seconds -- so it is set here rather than in the
-- API, where each client would read a slightly different clock.
--
-- Requires 20260916150000_vote_by_category.sql.
-- =============================================================================

alter table public.rounds add column if not exists vote_ends_at timestamptz;

-- Rewritten to stamp the deadline in the same statement that opens voting, so
-- both routes in -- the host ending the round and the answer clock expiring --
-- get one and cannot disagree about when voting started.
create or replace function public.end_round(p_round_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_game_id uuid;
  v_players int;
begin
  select game_id into v_game_id
    from rounds
   where id = p_round_id and status = 'playing';

  if v_game_id is null then
    return false;
  end if;

  -- Players who have gone quiet are not counted: they are not going to vote, and
  -- counting them would only stretch the wait for everyone still here.
  select count(*) into v_players
    from players p
   where p.game_id = v_game_id
     and p.kicked_at is null
     and p.left_at is null
     and p.last_seen_at > now() - interval '90 seconds';

  update rounds
     set status = 'voting',
         ended_at = now(),
         vote_ends_at = now() + make_interval(secs => 5 * greatest(v_players, 1))
   where id = p_round_id and status = 'playing';

  if not found then
    return false;
  end if;

  update games set status = 'voting', version = version + 1, updated_at = now()
   where id = v_game_id and status = 'playing';
  return true;
end;
$$;

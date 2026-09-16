-- =============================================================================
-- The voting window scales with the categories, not just the players.
--
-- 20260916160000 gave the whole voting phase five seconds per player. Measured
-- against a real round that is far too short: with three players and four
-- categories it left fifteen seconds to review twelve answers, and a scripted
-- client voting flat out -- no reading, no hesitation -- could not finish even
-- the first category before the server settled the round.
--
-- The window is now five seconds per player per category, so it grows with the
-- work actually in front of the room: the same round gets sixty seconds.
--
-- Requires 20260916160000_vote_deadline.sql.
-- =============================================================================

create or replace function public.end_round(p_round_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_game_id    uuid;
  v_players    int;
  v_categories int;
begin
  select game_id, coalesce(array_length(categories, 1), 1)
    into v_game_id, v_categories
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
         vote_ends_at = now() + make_interval(secs => 5 * greatest(v_players, 1) * greatest(v_categories, 1))
   where id = p_round_id and status = 'playing';

  if not found then
    return false;
  end if;

  update games set status = 'voting', version = version + 1, updated_at = now()
   where id = v_game_id and status = 'playing';
  return true;
end;
$$;

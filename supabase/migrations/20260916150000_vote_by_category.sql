-- =============================================================================
-- Voting walks the categories one at a time, in step for everyone.
--
-- The board used to show every category at once. Now the round carries the
-- category currently under review, and it only moves on once every player who
-- is still around has voted on every answer in it.
--
-- Requires 20260916140000_leave_vs_kick.sql (players.left_at) -- run that first.
-- =============================================================================

alter table public.rounds add column if not exists vote_category_index int not null default 0;

-- -----------------------------------------------------------------------------
-- Advance past every category whose votes are all in, and report where we land.
--
-- Done in SQL, and under a row lock, because several players can cast the last
-- vote at the same instant; deciding this in the API would skip categories.
-- Blank answers are not votable, so a category nobody filled in falls through
-- immediately -- hence the loop rather than a single step.
--
-- Players who went quiet are ignored, or one person closing their tab would
-- park the round on a category forever.
-- -----------------------------------------------------------------------------
create or replace function public.advance_vote_category(p_round_id uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_round   rounds%rowtype;
  v_idx     int;
  v_total   int;
  v_cat     text;
  v_pending int;
begin
  select * into v_round from rounds where id = p_round_id for update;
  if not found or v_round.status <> 'voting' then
    return -1;
  end if;

  v_idx   := v_round.vote_category_index;
  v_total := coalesce(array_length(v_round.categories, 1), 0);

  loop
    exit when v_idx >= v_total;
    v_cat := v_round.categories[v_idx + 1];   -- Postgres arrays start at 1

    select count(*) into v_pending
      from answers a
      join players p
        on p.game_id = v_round.game_id
       and p.kicked_at is null
       and p.left_at is null
       and p.last_seen_at > now() - interval '90 seconds'
       and p.id <> a.player_id                -- nobody votes on their own answer
     where a.round_id = p_round_id
       and a.category = v_cat
       and coalesce(a.normalized, '') <> ''
       and not exists (
             select 1 from votes v
              where v.answer_id = a.id
                and v.voter_player_id = p.id
           );

    exit when v_pending > 0;
    v_idx := v_idx + 1;
  end loop;

  if v_idx <> v_round.vote_category_index then
    update rounds set vote_category_index = v_idx where id = p_round_id;
  end if;
  return v_idx;
end;
$$;

-- Same posture as the other RPCs: the API reaches these with the service role,
-- never the browser.
revoke execute on function public.advance_vote_category(uuid) from public, anon, authenticated;
grant execute on function public.advance_vote_category(uuid) to service_role;

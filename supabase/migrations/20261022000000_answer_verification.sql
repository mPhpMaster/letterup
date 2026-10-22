-- Answers the game can confirm on its own (bundled word lists, or Wikidata) count
-- without a vote. Nothing is ever rejected automatically: an unknown answer just
-- goes to the players' vote as before.

alter table public.answers add column if not exists verified boolean not null default false;
-- A spelling the game recognised: the list/Wikidata form of what was typed
-- ("palastine" -> "palestine"). Set on verified answers and on typo suggestions.
alter table public.answers add column if not exists verified_as text;

-- Online lookups take ~0.5 s each; remember every answer once checked, both ways.
create table if not exists public.answer_checks (
  category   text        not null,
  lang       text        not null,
  normalized text        not null,
  known      boolean     not null,
  label      text,
  checked_at timestamptz not null default now(),
  primary key (category, lang, normalized)
);
alter table public.answer_checks enable row level security;
revoke all on public.answer_checks from anon, authenticated;

-- Same as before, except verified answers no longer wait for anybody's vote, so a
-- category whose answers were all confirmed moves on at once.
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
       and not a.verified                     -- confirmed answers need no vote
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
revoke execute on function public.advance_vote_category(uuid) from public, anon, authenticated;
grant execute on function public.advance_vote_category(uuid) to service_role;

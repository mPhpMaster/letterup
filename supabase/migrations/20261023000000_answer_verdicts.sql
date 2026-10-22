-- Players teach the game. An answer outside the dictionary now needs a 👍 to count,
-- and every vote-decided answer is remembered: once players have approved a word
-- more often than rejected it, it is confirmed automatically next time (allow list);
-- the other way round, it starts out rejected (block list) until somebody 👍s it.

-- Not confirmed by the dictionary/Wikidata/allow list: counts only with a 👍.
alter table public.answers add column if not exists needs_approval boolean not null default false;
-- Players rejected this word before (block list). Implies needs_approval.
alter table public.answers add column if not exists blocked boolean not null default false;

create table if not exists public.answer_verdicts (
  category   text        not null,
  lang       text        not null,
  normalized text        not null,
  display    text        not null,
  good       int         not null default 0,
  bad        int         not null default 0,
  updated_at timestamptz not null default now(),
  primary key (category, lang, normalized)
);
alter table public.answer_verdicts enable row level security;
revoke all on public.answer_verdicts from anon, authenticated;

-- Adds one round's outcomes to the tallies. Rows must be unique per key.
create or replace function public.record_answer_verdicts(p_rows jsonb)
returns void
language sql
set search_path = public
as $$
  insert into answer_verdicts (category, lang, normalized, display, good, bad)
  select r->>'category', r->>'lang', r->>'normalized', r->>'display', (r->>'good')::int, (r->>'bad')::int
    from jsonb_array_elements(p_rows) r
  on conflict (category, lang, normalized) do update
    set good       = answer_verdicts.good + excluded.good,
        bad        = answer_verdicts.bad + excluded.bad,
        display    = excluded.display,
        updated_at = now();
$$;
revoke execute on function public.record_answer_verdicts(jsonb) from public, anon, authenticated;
grant execute on function public.record_answer_verdicts(jsonb) to service_role;

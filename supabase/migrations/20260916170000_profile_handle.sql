-- =============================================================================
-- Remember the Discord handle so people can be found by it.
--
-- profiles.username holds the display name (global_name), and the handle it was
-- derived from was thrown away at sign-in. Searching only matched display names,
-- so looking someone up by the @name you actually know them by found nothing.
--
-- No index: the lookup is a substring match (ilike '%term%'), which a plain btree
-- cannot serve anyway, and the table is small enough that a scan is honest.
--
-- Requires 20260916160000_vote_deadline.sql.
-- =============================================================================

alter table public.profiles add column if not exists handle text;

comment on column public.profiles.handle is
  'Discord username (the @handle), kept alongside the display name so search can match either.';

-- =============================================================================
-- Leaving a lobby has to be undoable; a host kick does not.
--
-- Both used to stamp players.kicked_at, and every player query hides stamped
-- rows. The Discord join path re-upserted the player without clearing the
-- stamp, so anyone who pressed "leave lobby" was locked out of that Activity
-- instance for good -- every later request answered "You are not in this game"
-- and the Activity never got past its boot screen.
--
-- Leaves now stamp left_at, which joining clears. kicked_at is left alone, so
-- a kick still sticks. Permanent, account-wide exclusion stays with the admin
-- ban in profiles.banned_at.
-- =============================================================================

alter table public.players add column if not exists left_at timestamptz;

-- Existing stamps all predate the split and cannot be told apart, but the rows
-- we could inspect were leaves (players stamped while alone in their own room,
-- with nobody present to kick them). Clear them: under the new rule they would
-- otherwise be permanent lockouts nobody asked for.
update public.players set kicked_at = null where kicked_at is not null;

-- -----------------------------------------------------------------------------
-- Both functions that count players have to skip leavers as well as kicked
-- players, or a player who left still shows in the room list and still earns
-- lifetime stats for the game they walked out of.
-- -----------------------------------------------------------------------------
create or replace function public.record_game_stats(p_game_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_rounds int;
  v_top int;
begin
  update games set stats_recorded_at = now()
   where id = p_game_id and stats_recorded_at is null;
  if not found then
    return false;
  end if;

  select count(*) into v_rounds from rounds where game_id = p_game_id and status = 'scored';
  select coalesce(max(score), 0) into v_top
    from players
   where game_id = p_game_id and kicked_at is null and left_at is null;

  insert into profiles (user_id, username, avatar_url, games_played, wins, rounds_played, total_points, best_score)
  select p.user_id,
         p.username,
         p.avatar_url,
         1,
         case when p.score = v_top and v_top > 0 then 1 else 0 end,
         v_rounds,
         p.score,
         p.score
    from players p
   where p.game_id = p_game_id and p.kicked_at is null and p.left_at is null
  on conflict (user_id) do update
    set games_played  = profiles.games_played + 1,
        wins          = profiles.wins + excluded.wins,
        rounds_played = profiles.rounds_played + excluded.rounds_played,
        total_points  = profiles.total_points + excluded.total_points,
        best_score    = greatest(profiles.best_score, excluded.best_score),
        username      = excluded.username,
        avatar_url    = excluded.avatar_url;
  return true;
end;
$$;

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
             and p.left_at is null
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

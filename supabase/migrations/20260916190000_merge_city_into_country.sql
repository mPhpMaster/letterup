-- "Country" and "City" are now one category, "Country / City" (id: country).
-- Rewrite saved lobby settings so a room that had City picked starts its next round
-- with the merged category instead of a retired one. Order is kept, duplicates dropped.
-- Past rounds keep their stored categories untouched; the app still labels "city".
update public.settings s
   set categories = (
     select array_agg(id order by first_pos)
       from (
         select case when c = 'city' then 'country' else c end as id,
                min(pos) as first_pos
           from unnest(s.categories) with ordinality as u(c, pos)
          group by 1
       ) merged
   )
 where 'city' = any (s.categories);

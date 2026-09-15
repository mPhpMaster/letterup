# Human, Animal, Plant, Object — Discord Activity

**إنسان، حيوان، نبات، جماد.** A multiplayer word game that runs inside a Discord voice channel as an Activity.
Built with Next.js (App Router) on Vercel, Supabase (Postgres + Realtime), and the Discord Embedded App SDK.
The UI comes in English and Arabic, with full right-to-left layout for Arabic.

## How a game works

1. **Lobby.** Everyone who launches the Activity in the voice channel lands in the same lobby. The first person to join becomes the host. The host sets the round length, the number of rounds, which alphabet letters come from (English A–Z or Arabic أ–ي, with an option to skip hard letters), and which categories are in play. Everyone else can mark themselves ready.
2. **Round.** The server picks a letter that hasn't been used yet this game. Every player sees it for 3 seconds before the timer starts. Players fill in one answer per category. Answers auto-save while you type. The round closes when the timer runs out, when every connected player has pressed **Done**, or when the host ends it.
3. **Voting.** Answers are shown grouped by category. Players give 👍 or 👎 on other players' answers, and scores update live as votes come in. The host can overrule any answer with ✓ or ✗, then presses **Confirm scores**.
4. **Results.** After each round there's a scoreboard. After the last round comes the final leaderboard, with a podium and confetti. **Play again** sends everyone back to the lobby with the same settings.

### Scoring (`src/lib/scoring.ts`)

| Answer | Points |
| --- | --- |
| Valid, and nobody else wrote the same word in that category | **10** |
| Valid, but another player wrote the same word | **5** |
| Invalid, blank, or wrong starting letter | **0** |

The server decides whether an answer is valid, in this order:

1. A blank answer is never valid.
2. A host ruling beats everything else.
3. An answer that doesn't start with the round letter is invalid.
4. Otherwise the vote decides. The author counts as one 👍, and the answer is thrown out only if 👎 votes outnumber 👍 votes. This means that in a 2-player game one person can't veto the other alone; the host settles those disputes.

Matching ignores case, accents, and Arabic diacritics. It treats أ/إ/آ/ا as the same letter, and likewise ى/ي and ة/ه. A leading "ال" or "the " is also allowed. So "الأسد" counts for أ, and "The Rock" counts for R.

## Architecture

```
Discord client ──iframe──▶ https://<client_id>.discordsays.com  (Discord proxy)
                              │  /             → your Vercel app
                              │  /supabase     → <ref>.supabase.co   (Realtime websocket)
                              │  /discord-cdn  → cdn.discordapp.com  (avatars)
                              ▼
Next.js on Vercel
  /api/auth/discord      trades the OAuth code for a token, checks the user with Discord, returns a signed session (JWT)
  /api/game/[action]     join · state · settings · ready · start · answers · endRound · vote · verdict · tally · next · lobby
        │ service-role key
        ▼
Supabase Postgres  ── Realtime (postgres_changes on `games`) ──▶ every client refetches state
```

* **The server is in charge.** Every write goes through `/api/game/*`, which checks the Discord session before touching the database. Picking letters, round deadlines, closing rounds, and scoring all happen on the server. Race-prone steps run as atomic SQL functions (`start_round`, `end_round`, `apply_round_scores`).
* **Syncing clients.** Each change bumps `games.version`. Clients subscribe to that row through Supabase Realtime and refetch a view of the game tailored to them. Clients also poll `state` every 5 seconds. That poll doubles as a heartbeat (who's online, host handover) and as a fallback if the websocket drops.
* **Timer.** `rounds.ends_at` is set in Postgres. Clients measure how far their clock is from the server's on each response and count down to the server's deadline. The server accepts answers up to 2 seconds after the deadline to catch the last auto-save, then closes the round itself.
* **No peeking.** While a round is running, the API only returns *your own* answers. The anon key can read nothing except the `games` row, and no table accepts writes from the client.
* **Players who join or leave.**
  * Players who join mid-game get in immediately and can play whatever time is left in the current round.
  * Players who don't send a heartbeat for 20 seconds are marked Away. They no longer block "everyone submitted."
  * If the host is gone for 30 seconds, the host role passes to the longest-present online player.

## Project layout

```
supabase/migrations/…_init.sql   tables, RLS, triggers, RPCs, realtime publication
src/app/api/auth/discord         OAuth2 code exchange → session token
src/app/api/auth/guest           local test mode (ALLOW_GUEST_MODE=true only)
src/app/api/game/[action]        game action router
src/server/game.ts               all game rules and state projection
src/server/session.ts            session JWT (jose)
src/lib/letters.ts               alphabets, normalization, letter check
src/lib/scoring.ts               validity + points (shared by server and live preview)
src/lib/discord.ts               Embedded App SDK boot + URL mapping patches
src/hooks/useGame.ts             realtime subscription, polling, clock sync
src/components/                  Lobby, RoundPlay, Voting, RoundResults, FinalLeaderboard
src/i18n/en.json, ar.json        every UI string (CLDR plural forms for Arabic)
tests/                           node:test unit tests (scoring, letters, i18n key parity)
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migration. Either:
   * run `supabase link --project-ref <ref>` and then `supabase db push`, or
   * paste `supabase/migrations/20260915000000_init.sql` into the SQL editor.
3. From **Project Settings → API**, copy:
   * the project URL
   * the **anon** key (or the `sb_publishable_…` key)
   * the **service_role** key (or the `sb_secret_…` key)
4. Optional: to delete games idle for more than a day, enable `pg_cron` and schedule the cleanup:
   ```sql
   select cron.schedule('cleanup-games', '0 * * * *', 'select public.cleanup_stale_games()');
   ```

### 2. Discord Developer Portal

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and click **New Application**.
2. On the **OAuth2** page:
   * Copy the **Client ID** and **Client Secret**.
   * Add the redirect URI `https://127.0.0.1`. Discord requires one, but Activities never actually use it.
3. On **Activities → Getting Started**, enable Activities for the app.
4. On **Activities → URL Mappings**, add these mappings. Targets have no `https://` and no trailing slash.

   | Prefix | Target |
   | --- | --- |
   | `/` | `your-app.vercel.app` |
   | `/supabase` | `<project-ref>.supabase.co` |
   | `/discord-cdn` | `cdn.discordapp.com` |

   The app calls `patchUrlMappings()` on startup. That rewrites Supabase and avatar URLs to go through these prefixes, because Discord's content security policy (CSP) blocks every host that isn't mapped.
5. On **Installation**, enable **Guild Install** and **User Install**.
6. On **Activities → Settings**, choose the supported platforms: Web, iOS, and Android. The layout is responsive and works on phones.
7. OAuth scopes requested at runtime: `identify` and `guilds`.
8. To launch it, join a voice channel, open the 🚀 **Activities** menu, and pick your app. While the app is unverified, only you, your team members, and users you add under **App Testers** can launch it.

### 3. Vercel

1. Import the repo into Vercel. The framework preset is detected automatically.
2. Add these environment variables (see `.env.example`):

   | Variable | Where it's used |
   | --- | --- |
   | `NEXT_PUBLIC_DISCORD_CLIENT_ID` | client + server |
   | `DISCORD_CLIENT_SECRET` | server only |
   | `NEXT_PUBLIC_SUPABASE_URL` | client + server |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client (Realtime only) |
   | `SUPABASE_SERVICE_ROLE_KEY` | server only |
   | `SESSION_SECRET` | server only. Generate with `openssl rand -base64 32` |
   | `ALLOW_GUEST_MODE` | set `false` in production |

3. **Turn off Deployment Protection** for the environment Discord points at (Project → Settings → Deployment Protection). Otherwise Discord's proxy gets a Vercel login page instead of the game.
4. Framing headers: `next.config.ts` sends `Content-Security-Policy: frame-ancestors` with Discord's domains (`discord.com`, `*.discord.com`, `*.discordsays.com`). It doesn't send `X-Frame-Options`, so the page can be embedded. No `vercel.json` is needed.
5. Point the `/` URL mapping at your production domain.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

**Without Discord (quickest).** With `ALLOW_GUEST_MODE=true`, open `http://localhost:3000`, pick a name and a room code, then open more tabs with the same `?room=` to play against yourself. Each tab gets its own guest identity. Guest rooms are kept separate from real Discord instances.

**Inside Discord.** Expose your dev server over HTTPS and point the `/` URL mapping at it:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

If hot reload complains about the tunnel host, add it to `allowedDevOrigins` in `next.config.ts`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | production build |
| `npm run lint` | TypeScript type-check |
| `npm test` | unit tests for scoring, letter normalization, and that en/ar have matching keys and all used keys exist |

## Adding a category or a language string

* **New category:**
  1. Add `{ id, emoji }` to `src/lib/categories.ts`.
  2. Add `categories.<id>` to both `en.json` and `ar.json`.
  3. Run `npm test`. It fails if a label is missing in either language.
* **New UI string:** add the key to both JSON files and use `t("section.key", { vars })`. For counts, pass `count`. Arabic plural forms (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`) are picked automatically.

## Hardening ideas

* Confirm that a Discord user really is in the Activity instance before `join`. Call `GET /applications/{id}/activity-instances/{instance_id}` with a bot token. Today the instance id is treated as a secret you can only get by being in the call.
* Add rate limiting to `/api/game/*`, for example with Vercel Firewall rules.

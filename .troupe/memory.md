---
built_at: 2026-09-20T07:48:55.202411Z
---

## Overview

Greenfield repo /home/simmetopia/code/funsies/strikke-event: a Danish "knitting
event registration" throwaway app. Planned stack (see todo list, versions
verified ~Sept 2026): Deno 2.9.7 runtime; Deno.serve for HTTP; server-rendered
HTML fragments; htmx.org 4.0.0 pinned from CDN (unpkg/jsdelivr) for the
interactive dashboard (polling table, search, delete, morph swaps,
<hx-partial>); persistence via built-in Deno.openKv file-backed (data/app.kv),
namespaced per year: ['reg', year, id], ['email', year, email] -> id; no other
runtime deps. Auth is exactly three nonces from env (SIGNUP_TOKEN, ADMIN_TOKEN,
REGISTRATOR_TOKEN) + an httpOnly HMAC-SHA256 session cookie (SESSION_SECRET);
unauthorized -> 404. Current year = EVENT_YEAR (default current year), admin
"nyt år" action increments it. UI text is Danish (UTF-8). Visit /tilmeld/<token>
to sign up, /admin/<token> and /registrar/<token> for the holder/helper
dashboards.

## Notes

- 2026-09-20 plan-1: 2026-09-20 plan-1 (CORRECTION to the --unstable-kv note,
  from the live Coolify deploy): the `--unstable-kv` requirement is
  VERSION-SPECIFIC and must NOT be baked into the deployed start command. The
  nixpacks/Coolify image runs a Deno that REJECTS `--unstable-kv`
  (`error: unexpected argument '--unstable-kv' found … similar argument exists: '--unstable'`)
  and has `Deno.openKv` stable with no flag — i.e. newest Deno 2.9.7+. The local
  sandbox happens to be the transitional 2.9.6 build which still needs
  `--unstable-kv`. Resolution baked into the repo: both deno.json `dev` and
  `start` tasks are flag-free (no --unstable-kv), and main.ts starts with a
  guard that prints a clear, actionable message and Deno.exit(1) if
  `typeof Deno.openKv !== "function"` (covering 2.9.6 / very old --unstable
  builds). README documents the override for Coolify's Start Command if a server
  Deno genuinely needs the flag.
- 2026-09-20 plan-1: 2026-09-20 plan-1 (verified while implementing): in the
  Deno 2.9.x builds this app targets, Deno.openKv is gated behind the
  `--unstable-kv` flag — `typeof Deno.openKv` is `undefined` without it and
  `function` with `deno run --unstable-kv …` (probed empirically on 2.9.6). So
  BOTH the deno.json `dev` and `start` tasks must include `--unstable-kv`; since
  nixpacks runs the literal deno.json `tasks.start` string as the start command,
  the flag is carried to Coolify automatically.
- 2026-09-20 plan-1: 2026-09-20 plan-1: Deploy target & routes decided by the
  user (supersedes the earlier /tilmeld/<token> idea): exactly two nonce URLs —
  GET /signup?nonce= and GET /admin?nonce= — plus SESSION_SECRET; the
  registrar/REGISTRATOR_TOKEN role is DROPPED to keep it simple. Deploy =
  nixpacks on Coolify (verified from railwayapp/nixpacks src/providers/deno.rs):
  Deno provider detects deno.json; build phase runs `deno cache <first index.*>`
  (the docs page's "deno compile" claim is stale/wrong); start phase = the
  literal string from deno.json tasks.start if present, else
  `deno run --allow-all index.ts`. Consequence: the nixpacks `start` task must
  NOT use --env-file (Coolify injects env vars into the container); keep
  --env-file in a separate `dev` task. Deno.openKv file-backed kv in a container
  is ephemeral across redeploys, so expose a KV_PATH env override (default
  data/app.kv) and have Coolify mount a persistent volume for it. App has no
  remote Deno imports (pure globals Deno.serve/openKv/crypto + htmx from CDN),
  so `deno cache` is trivial and builds are fast.
- 2026-09-20 plan-1: htmx version gotcha (corrected 2026-09-20): the newest htmx
  IS 4.0.0 (released 2026-08-28, v4 docs at four.htmx.org) — but the npm
  `latest` dist-tag is DELIBERATELY stuck on 2.0.10 until ~early 2027, so
  querying npm "latest" (or unpkg/jsdelivr unversioned URLs) returns 2.x. Always
  pin htmx.org@4.0.0 exactly (https://unpkg.com/htmx.org@4.0.0/dist/htmx.min.js,
  jsdelivr equivalent; `next` tag = 4.0.0). There is still no htmx 5 (they
  jumped 2 -> 4). htmx 4 changes that matter: attribute inheritance is now
  explicit (`:inherited` suffix), event names renamed (htmx:afterRequest ->
  htmx:after:request), morphing swaps built-in (hx-swap="morph"), new
  <hx-partial> tag. Newest Deno is v2.9.7 (curl -fsSL
  https://deno.land/install.sh | sh); run with
  `deno run --watch --env-file=.env -A main.ts`; secrets via
  `deno task generate-tokens` (crypto.getRandomValues). Deno Deploy has no
  local-file Deno.openKv, so hosted deploy needs a different store — this app is
  self-hosted (VPS/laptop).
- 2026-09-20 plan-1: Version gotcha: there is no "htmx 5" — the newest htmx.org
  is 2.0.10 (current major is 2.x), and newest Deno is v2.9.7 (installed via

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
- 2026-09-20 code-1: 2026-09-20 deploy-fix: nixpacks.toml build cmds must be SINGLE-LINE commands — nixpacks emits a multi-line build command string into the Dockerfile as raw physical lines (only the first gets `RUN `), which fails the build with "dockerfile parse error: unknown instruction: mkdir". The pinned-Deno download logic therefore lives in scripts/install-deno.sh and the build cmd is just `bash scripts/install-deno.sh` (single RUN line). Verified: script downloads Deno v2.9.7 from dl.deno.land into .runtime/; that binary exposes Deno.openKv only with --unstable-kv, and the app boots with the [start] cmd `./.runtime/deno run --unstable-kv --allow-net --allow-read --allow-write --allow-env main.ts`.
- 2026-09-20 plan-1: 2026-09-20 plan-1 (verified empirically by downloading Deno
  2.9.7): the newest Deno 2.9.7 behaves EXACTLY like the sandbox's 2.9.6 —
  `Deno.openKv` is `function` only with `--unstable-kv`, `undefined` both
  flag-free and with `--unstable` (that flag is removed in 2.0). So the earlier
  assumption "2.9.7+ has openKv stable and rejects --unstable-kv" was WRONG. The
  REAL fix for the broken Coolify deploy: nixpacks' nixpkgs `deno` is UNPINNED
  and its build may not expose `Deno.openKv` at all (user saw "Deno.openKv is
  not available in this Deno build" after the flag was removed). Resolution now
  in the repo: nixpacks.toml pins Deno v2.9.7 — the build phase downloads it
  from https://dl.deno.land/release/v2.9.7/deno-{arch}.zip into .runtime/ (via
  curl + unzip, both added as nixPkgs) and [start] cmd = "./.runtime/deno run
  --unstable-kv --allow-net --allow-read --allow-write --allow-env main.ts".
  deno.json dev/start tasks carry --unstable-kv again; main.ts guard explains
  the required flag.
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

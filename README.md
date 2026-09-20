# Strikkefest — a knitting-event signup app 🧶

A small, fun, throwaway app so your wife can take signups for her knitting
event: one magic link to share with guests, one private admin link to see who's
coming. Built with **Deno** on the backend and **htmx 4** on the front — no
build step, no npm, no database server. Registrations live in a single file
(`data/app.kv`) via Deno's built-in KV.

UI text is Danish, code is English.

## How it works

Two secret links (nonces), defined by environment variables:

| Route                | Env var        | What it does                              |
| -------------------- | -------------- | ----------------------------------------- |
| `GET /signup?nonce=` | `SIGNUP_TOKEN` | Guest signup form (Navn, E-mail, besked)  |
| `GET /admin?nonce=`  | `ADMIN_TOKEN`  | Dashboard: live list, search, delete, CSV |

A wrong or missing nonce answers `404`, as if the page didn't exist.

Opening a valid link hands you an httpOnly, HMAC-SHA256-signed session cookie,
so the htmx requests that follow (polling, search, delete) stay authenticated
without the nonce being passed around again.

The admin dashboard:

- the list refreshes itself every 5 seconds (htmx polling),
- the search box filters live while you type,
- rows can be deleted (with a confirmation),
- **Nyt år 🎉** starts a fresh, empty year (old years stay archived in the
  file),
- **Hent liste (CSV)** downloads the list as a UTF-8 `;`-separated CSV that
  Danish Excel opens cleanly.

## Run locally

1. Install Deno ≥ 2: <https://deno.land>
2. Create your secrets:
   ```sh
   deno task generate-tokens
   ```
   Copy the three lines into a `.env` file (or start from `.env.example`).
3. Run the dev server (auto-reloads on change, reads `.env`):
   ```sh
   deno task dev
   ```
4. Open the two magic links (values from your `.env`):
   - Signup: `http://localhost:8000/signup?nonce=…`
   - Admin: `http://localhost:8000/admin?nonce=…`

Registrations are written to `data/app.kv` (override with `KV_PATH`).

## Deploy on Coolify with Nixpacks

Nixpacks detects Deno because this repo has a `deno.json` (and `nixpacks.toml`
pins the provider). The start command is taken verbatim from `deno.json` →
`tasks.start` and deliberately does **not** use `--env-file`, because Coolify
injects environment variables directly into the container.

1. Push this repository to GitHub / GitLab / Gitea.
2. In Coolify: **New resource** → pick the repository.
3. Build pack: **Nixpacks** (leave build command / start command empty — they
   come from `nixpacks.toml` and `deno.json`).
4. **Environment variables** — at least:
   ```
   SIGNUP_TOKEN=<random hex>
   ADMIN_TOKEN=<random hex>
   SESSION_SECRET=<random hex>
   ```
   Generate them locally with `deno task generate-tokens`. Optional:
   `EVENT_NAME` (default `Strikkefest`), `EVENT_YEAR` (default this year),
   `PORT` (default `8000`), `KV_PATH`.
5. **Persistent storage (important):** the KV database is a plain file in the
   container, so it would vanish on every redeploy. Add a Coolify volume and
   point the app at it, e.g. mount a volume at `/data` and set
   ```
   KV_PATH=/data/app.kv
   ```
6. **Deploy.** The container then starts with:
   `deno run --allow-net --allow-read --allow-write --allow-env main.ts`

   No `--unstable-kv` here on purpose: newer Deno (2.9.7+) has `Deno.openKv`
   stable and **rejects** the `--unstable-kv` flag (that's the
   `unexpected argument '--unstable-kv' found` error). If your server's Deno
   genuinely needs a flag (e.g. the transitional 2.9.6 build), override the
   **Start Command** in Coolify with `--unstable-kv` added — see the gotchas
   below.

Coolify usually terminates HTTPS in front of the app; the session cookie does
not set `Secure` by default so it keeps working on plain `http://` during local
development too.

## Project layout

| File            | Purpose                                   |
| --------------- | ----------------------------------------- |
| `main.ts`       | HTTP router (`Deno.serve`)                |
| `kv.ts`         | Data layer on top of `Deno.openKv`        |
| `auth.ts`       | Nonce checks + HMAC session cookies       |
| `pages.ts`      | HTML rendering, all the Danish UI text    |
| `tokens.ts`     | `deno task generate-tokens`               |
| `deno.json`     | Tasks (`dev`, `start`, `generate-tokens`) |
| `nixpacks.toml` | Pins the Deno provider for Nixpacks       |

## Decisions & gotchas

- **htmx 4.0.0** is the newest htmx, but npm's `latest` tag is stuck on 2.0.x,
  so the script tag pins `https://unpkg.com/htmx.org@4.0.0/dist/htmx.min.js`
  exactly.
- No remote Deno imports at all — only Deno's built-ins — so the container build
  is trivial (`deno cache` has almost nothing to do).
- **`Deno.openKv` flag differs by Deno build.** 2.9.7+ has it stable (no flag,
  and it _rejects_ `--unstable-kv`); the transitional 2.9.6 build needs
  `--unstable-kv`; very old builds use `--unstable`. The tasks are written
  flag-free for the latest Deno, and `main.ts` fails fast with this exact advice
  if a build hides `Deno.openKv` behind a flag. Add `--unstable-kv` to the
  Coolify **Start Command** only if your server's Deno demands it.
- Unauthenticated requests answer `404`, so the service looks empty from
  outside.
- This is a throwaway app: no email sending, no password resets — nice and
  simple ✂

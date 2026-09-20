// HTML rendering and Danish UI text. The app's *content* is Danish; the code
// (identifiers, comments) is English. htmx 4.0.0 is pinned from the CDN —
// npm's "latest" tag is stuck on 2.0.x, so never use an unversioned URL here.

import type { Signup } from "./kv.ts";

const HTMX_URL = "https://unpkg.com/htmx.org@4.0.0/dist/htmx.min.js";
// The live table re-renders shortly after load and then every 5 seconds.
const POLL = "load delay:250ms, every 5s";

export interface AdminState {
  eventName: string;
  year: number;
  q: string;
  signups: Signup[];
}

// ---------- HTML helpers ------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCsvDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("da-DK");
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script src="${HTMX_URL}"></script>
<style>
  :root {
    --cream: #fdf6ec;
    --ink: #3f2a20;
    --yarn: #e8a87c;
    --rose: #c15d5d;
    --card: #fffdf9;
    --edge: #e4d3bf;
    --muted: #8a7266;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cream); color: var(--ink);
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         line-height: 1.5; }
  h1 { margin: 0 0 1rem; font-size: 2rem; }
  .kort { max-width: 34rem; margin: 4rem auto; padding: 2rem; background: var(--card);
          border: 1px solid var(--edge); border-radius: 1rem;
          box-shadow: 0 4px 20px rgb(63 42 32 / .08); }
  .kicker { margin: 0 0 .4rem; text-transform: uppercase; letter-spacing: .12em;
            font-size: .75rem; font-weight: 700; color: var(--rose); }
  .ledetekst { margin: 0; }
  label { display: block; margin: 1.1rem 0 .35rem; font-weight: 600; }
  input, textarea { width: 100%; padding: .6rem .8rem; font: inherit; color: inherit;
                    background: #fff; border: 1px solid var(--edge); border-radius: .5rem; }
  textarea { resize: vertical; }
  input:focus, textarea:focus { outline: 2px solid var(--yarn); border-color: var(--yarn); }
  button, .knap { display: inline-block; margin-top: 1.25rem; padding: .7rem 1.3rem;
                  font: inherit; font-weight: 600; color: #fff; background: var(--ink);
                  border: 0; border-radius: .6rem; cursor: pointer; text-decoration: none; }
  button:hover, .knap:hover { background: var(--yarn); }
  .fejl { padding: .7rem .9rem; border: 1px solid #e8b4b4; border-radius: .5rem;
          background: #fdecec; color: #a03c3c; }
  .stille { margin-top: 1.5rem; font-size: .85rem; color: var(--muted); }
  .top { display: flex; justify-content: space-between; align-items: baseline;
         gap: 1rem; flex-wrap: wrap; }
  .soeg { margin: 1.25rem 0; }
  .soeg input { max-width: 26rem; }
  .tabel { width: 100%; border-collapse: collapse; background: var(--card);
           border: 1px solid var(--edge); border-radius: .6rem; overflow: hidden; }
  .tabel th, .tabel td { padding: .6rem .8rem; text-align: left; font-size: .92rem;
                         border-bottom: 1px solid var(--edge); vertical-align: top; }
  .tabel th { background: #f4e8da; font-size: .75rem; text-transform: uppercase;
              letter-spacing: .08em; }
  .tabel tr.tom td { color: var(--muted); font-style: italic; }
  .nr { width: 2.5rem; color: var(--muted); }
  .tid { white-space: nowrap; color: var(--muted); font-size: .85rem; }
  .slet { width: 4.5rem; }
  .slet-knap { margin: 0; padding: .35rem .7rem; font-size: .8rem;
               background: var(--rose); }
  .slet-knap:hover { background: #a03c3c; }
  .handlinger { display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap; }
  .handlinger .knap { background: var(--muted); }
  .handlinger .knap:hover { background: var(--ink); }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ---------- Signup --------------------------------------------------------

export interface SignupFormState {
  eventName: string;
  year: number;
  error?: string;
  navn?: string;
  email?: string;
  besked?: string;
}

export function signupPage(state: SignupFormState): string {
  return layout(`${state.eventName} · tilmelding`, formCard(state));
}

export function formCard(state: SignupFormState): string {
  const { eventName, year } = state;
  const error = state.error
    ? `<p class="fejl" role="alert">${escapeHtml(state.error)}</p>`
    : "";
  return `<main class="kort" id="signup-box">
  <p class="kicker">Tilmelding · ${year}</p>
  <h1>${escapeHtml(eventName)}</h1>
  <p class="ledetekst">Vi skal strikke, drikke kaffe og have det hyggeligt 🧶 Meld dig til herunder.</p>
  ${error}
  <form hx-post="/signup" hx-target="#signup-box" hx-swap="outerHTML">
    <label for="navn">Navn</label>
    <input id="navn" name="navn" required autofocus value="${
    escapeHtml(state.navn ?? "")
  }">
    <label for="email">E-mail</label>
    <input id="email" name="email" type="email" required value="${
    escapeHtml(state.email ?? "")
  }">
    <label for="besked">Har du en besked? <span style="font-weight:400; color:var(--muted)">(valgfri)</span></label>
    <textarea id="besked" name="besked" rows="3" placeholder="Fx allergier, hvad du vil strikke, hvor mange I kommer…">${
    escapeHtml(state.besked ?? "")
  }</textarea>
    <button type="submit">Tilmeld mig</button>
  </form>
  <p class="stille">Du får ingen bekræftelsesmail — bare duk op med dit garn.</p>
</main>`;
}

export function signupSuccess(
  eventName: string,
  year: number,
  navn: string,
): string {
  return `<main class="kort" id="signup-box">
  <p class="kicker">Tilmelding · ${year}</p>
  <h1>Tak, ${escapeHtml(navn)}!</h1>
  <p class="ledetekst">Du er nu på listen til ${
    escapeHtml(eventName)
  }. Vi glæder os til at strikke sammen 🧶</p>
</main>`;
}

// ---------- Admin dashboard ----------------------------------------------

const TABLE_ATTRS = `hx-get="/admin/tabel" hx-trigger="${POLL}" ` +
  `hx-target="#tabel-tbody" hx-swap="outerHTML"`;

export function adminPage(state: AdminState): string {
  return layout(`${state.eventName} · admin`, adminBody(state));
}

export function adminBody(state: AdminState): string {
  const { eventName, year, q, signups } = state;
  return `<main id="admin-body">
  <div class="top">
    <div>
      <p class="kicker">Administration · ${year}</p>
      <h1>${escapeHtml(eventName)}</h1>
    </div>
    <p>Tilmeldte i ${year}: <strong id="antal">${signups.length}</strong></p>
  </div>
  <form id="soeg" class="soeg" onsubmit="return false">
    <input type="search" name="q" placeholder="Søg efter navn eller e-mail…"
           value="${escapeHtml(q)}" autocomplete="off"
           hx-get="/admin/tabel" hx-trigger="input changed delay:300ms"
           hx-target="#tabel-tbody" hx-swap="outerHTML">
    <table class="tabel">
      <thead>
        <tr><th class="nr">#</th><th>Navn</th><th>E-mail</th><th>Besked</th><th class="tid">Tilmeldt</th><th class="slet"></th></tr>
      </thead>
      ${tbody(state)}
    </table>
  </form>
  <nav class="handlinger">
    <button type="button" hx-post="/admin/nyt-aar"
            hx-target="#admin-body" hx-swap="outerHTML"
            hx-confirm="Start et nyt strikkeår? Den nye årgang starter tom, og de gamle år bliver i arkivet.">
      Nyt år 🎉
    </button>
    <a class="knap" href="/admin/eksport">Hent liste (CSV)</a>
  </nav>
</main>`;
}

// The live table fragment: a <tbody> that swaps itself in and out and polls.
export function tbody(state: AdminState): string {
  const { signups, q } = state;
  const rows = signups.map(signupRow).join("\n");
  const empty = signups.length === 0
    ? `<tr class="tom"><td colspan="6">${
      q ? "Ingen matcher din søgning." : "Ingen tilmeldte endnu 🧶"
    }</td></tr>`
    : "";
  return `<tbody id="tabel-tbody" ${TABLE_ATTRS}>${rows}${empty}</tbody>`;
}

function signupRow(s: Signup): string {
  const name = escapeHtml(s.navn);
  return `<tr>
  <td class="nr">${s.id}</td>
  <td>${name}</td>
  <td>${escapeHtml(s.email)}</td>
  <td>${s.besked ? escapeHtml(s.besked) : "&nbsp;"}</td>
  <td class="tid">${formatDate(s.createdAt)}</td>
  <td class="slet">
    <button class="slet-knap" type="button" hx-delete="/admin/tilmeldte/${s.id}"
            hx-confirm="Fjern ${name} fra listen?"
            hx-target="#tabel-tbody" hx-swap="outerHTML">Slet</button>
  </td>
</tr>`;
}

// Everything the /admin/tabel endpoint answers: the tbody (target) plus an
// out-of-band update for the live count in the header.
export function tabelResponse(state: AdminState): string {
  return `${tbody(state)}
<span id="antal" hx-swap-oob="innerHTML">${state.signups.length}</span>`;
}

// ---------- CSV export ----------------------------------------------------

// UTF-8 BOM + ';' as separator so Danish Excel opens it without fuss.
export function csvExport(state: Pick<AdminState, "year" | "signups">): string {
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ["Nr", "Navn", "E-mail", "Besked", "Tilmeldt"],
    ...state.signups.map((s) => [
      String(s.id),
      s.navn,
      s.email,
      s.besked,
      formatCsvDate(s.createdAt),
    ]),
  ].map((row) => row.map(quote).join(";"));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

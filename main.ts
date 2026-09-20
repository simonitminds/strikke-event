// HTTP router. Danmarks hidden-in-plain-sight knitting-event app:
//
//   GET  /signup?nonce=…   -> Danish signup form (+ session cookie)
//   POST /signup           -> register, Danish confirmation or error
//   GET  /admin?nonce=…    -> admin dashboard (+ session cookie)
//   GET  /admin/tabel?q=…  -> live table fragment (polled by htmx)
//   DELETE /admin/tilmeldte/<id> -> remove one signup
//   POST /admin/nyt-aar    -> start a fresh, empty year
//   GET  /admin/eksport    -> CSV download for Danish Excel
//
// Anything unauthenticated answers 404, as if the route didn't exist.

// Deno.openKv needs the --unstable-kv flag on the Deno 2.9.x builds we target
// (verified on 2.9.6 and 2.9.7). If a build hides or lacks it we fail fast and
// clearly instead of 500ing on every request. The Nixpacks deploy pins Deno
// v2.9.7 (see nixpacks.toml) and runs with --unstable-kv.
if (typeof Deno.openKv !== "function") {
  console.error(
    "strikke-event: Deno.openKv is not available in this Deno build.\n" +
      "  Run with a Deno 2.9.x build and its KV flag, e.g.:\n" +
      "    deno run --unstable-kv --allow-net --allow-read --allow-write --allow-env main.ts",
  );
  Deno.exit(1);
}

import {
  isAdminNonce,
  isSignupNonce,
  issueSession,
  sessionCookieHeader,
  sessionFromRequest,
} from "./auth.ts";
import {
  addSignup,
  deleteSignup,
  getCurrentYear,
  listSignups,
  nextYear,
  type Signup,
} from "./kv.ts";
import * as pages from "./pages.ts";

const EVENT_NAME = Deno.env.get("EVENT_NAME") ?? "Strikkefest";
const PORT = Number(Deno.env.get("PORT") ?? 8000);

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

function notFound(): Response {
  return new Response("", { status: 404 });
}

function html(body: string): Response {
  return new Response(body, { headers: HTML_HEADERS });
}

async function signupsForYear(year: number, q?: string): Promise<Signup[]> {
  const signups = await listSignups(year);
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return signups;
  return signups.filter(
    (s) => s.navn.toLowerCase().includes(needle) || s.email.includes(needle),
  );
}

function adminState(
  year: number,
  signups: Signup[],
  q: string,
): pages.AdminState {
  return { eventName: EVENT_NAME, year, q, signups };
}

async function isAdminRequest(req: Request): Promise<boolean> {
  const session = await sessionFromRequest(req);
  return session !== null && session.role === "admin";
}

function favicon(): Response {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🧶</text></svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;
  const method = req.method;

  if (pathname === "/favicon.svg") return favicon();

  // --- Signup -----------------------------------------------------------
  if (pathname === "/signup" && method === "GET") {
    const nonce = url.searchParams.get("nonce") ?? "";
    if (!(await isSignupNonce(nonce))) return notFound();
    const year = await getCurrentYear();
    const token = await issueSession("signup");
    return new Response(pages.signupPage({ eventName: EVENT_NAME, year }), {
      headers: { ...HTML_HEADERS, "Set-Cookie": sessionCookieHeader(token) },
    });
  }

  if (pathname === "/signup" && method === "POST") {
    const session = await sessionFromRequest(req);
    if (!session || session.role !== "signup") return notFound();
    const form = await req.formData();
    const navn = String(form.get("navn") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const besked = String(form.get("besked") ?? "").slice(0, 500).trim();
    const year = await getCurrentYear();

    if (!navn || !email) {
      return html(pages.formCard({
        eventName: EVENT_NAME,
        year,
        error: "Udfyld venligst både navn og e-mail.",
        navn,
        email,
        besked,
      }));
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return html(pages.formCard({
        eventName: EVENT_NAME,
        year,
        error: "Det ligner ikke en gyldig e-mail.",
        navn,
        email,
        besked,
      }));
    }

    const result = await addSignup(year, { navn, email, besked });
    if (result.status === "duplicate") {
      return html(pages.formCard({
        eventName: EVENT_NAME,
        year,
        error:
          "Der er allerede en tilmelding med den e-mail. Skriv til os, hvis du skal ændre noget.",
        navn,
        email,
        besked,
      }));
    }
    return html(pages.signupSuccess(EVENT_NAME, year, result.signup.navn));
  }

  // --- Admin dashboard ---------------------------------------------------
  if (pathname === "/admin" && method === "GET") {
    const nonce = url.searchParams.get("nonce") ?? "";
    if (!(await isAdminNonce(nonce))) return notFound();
    const year = await getCurrentYear();
    const signups = await signupsForYear(year);
    const token = await issueSession("admin");
    return new Response(pages.adminPage(adminState(year, signups, "")), {
      headers: { ...HTML_HEADERS, "Set-Cookie": sessionCookieHeader(token) },
    });
  }

  // --- Admin: live table fragment (polling + search) ---------------------
  if (pathname === "/admin/tabel" && method === "GET") {
    if (!(await isAdminRequest(req))) return notFound();
    const year = await getCurrentYear();
    const q = url.searchParams.get("q") ?? "";
    const signups = await signupsForYear(year, q);
    return html(pages.tabelResponse(adminState(year, signups, q)));
  }

  // --- Admin: delete one signup -----------------------------------------
  const del = pathname.match(/^\/admin\/tilmeldte\/(\d+)$/);
  if (del && method === "DELETE") {
    if (!(await isAdminRequest(req))) return notFound();
    const year = await getCurrentYear();
    const q = url.searchParams.get("q") ?? "";
    await deleteSignup(year, Number(del[1]));
    const signups = await signupsForYear(year, q);
    return html(pages.tabelResponse(adminState(year, signups, q)));
  }

  // --- Admin: start a new year ------------------------------------------
  if (pathname === "/admin/nyt-aar" && method === "POST") {
    if (!(await isAdminRequest(req))) return notFound();
    const year = await nextYear();
    return html(pages.adminBody(adminState(year, [], "")));
  }

  // --- Admin: CSV export --------------------------------------------------
  if (pathname === "/admin/eksport" && method === "GET") {
    if (!(await isAdminRequest(req))) return notFound();
    const year = await getCurrentYear();
    const signups = await listSignups(year);
    return new Response(pages.csvExport({ year, signups }), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tilmeldte-${year}.csv"`,
      },
    });
  }

  return notFound();
}

Deno.serve({ port: PORT }, handler);

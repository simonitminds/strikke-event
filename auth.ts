// Authentication. Two nonces come from the environment (SIGNUP_TOKEN and
// ADMIN_TOKEN). Showing a valid nonce in the URL (e.g. /admin?nonce=abc…)
// buys you an httpOnly, HMAC-SHA256-signed session cookie that authenticates
// the htmx requests that follow. Anything unauthenticated answers 404 so the
// endpoints stay invisible to outsiders.

const COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

export type Role = "signup" | "admin";

export interface SessionPayload {
  role: Role;
  exp: number; // unix seconds
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string comparison, so the response leaks nothing about how
// close a guess was.
function safeEqual(a: string, b: string): Promise<boolean> {
  const da = new TextEncoder().encode(a);
  const db = new TextEncoder().encode(b);
  if (da.length !== db.length) return Promise.resolve(false);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return Promise.resolve(diff === 0);
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return toHex(new Uint8Array(sig));
}

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
  return atob(b64 + "=".repeat(pad));
}

function env(flag: string): string {
  return Deno.env.get(flag) ?? "";
}

export function isSignupNonce(candidate: string): Promise<boolean> {
  const expected = env("SIGNUP_TOKEN");
  if (!expected) return Promise.resolve(false);
  return safeEqual(candidate.trim(), expected);
}

export function isAdminNonce(candidate: string): Promise<boolean> {
  const expected = env("ADMIN_TOKEN");
  if (!expected) return Promise.resolve(false);
  return safeEqual(candidate.trim(), expected);
}

export async function issueSession(role: Role): Promise<string> {
  const secret = env("SESSION_SECRET");
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const payload: SessionPayload = {
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = await hmacSha256(secret, body);
  return `${body}.${sig}`;
}

export async function readSession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = env("SESSION_SECRET");
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSha256(secret, body);
  if (sig.length !== expected.length) return null;
  if (!(await safeEqual(sig, expected))) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(unb64url(body));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (payload.role !== "signup" && payload.role !== "admin") return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return null;
  }
  return payload;
}

export function sessionFromRequest(
  req: Request,
): Promise<SessionPayload | null> {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === COOKIE_NAME) {
      return readSession(part.slice(eq + 1).trim());
    }
  }
  return Promise.resolve(null);
}

export function sessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

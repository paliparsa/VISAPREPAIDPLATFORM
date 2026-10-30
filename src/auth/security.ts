import type { Context } from "hono";
import type { Env } from "../types";

export interface CurrentUser {
  id: string;
  email: string;
  role: "CUSTOMER" | "OWNER" | "ADMIN" | "SUPPORT" | "FINANCE";
}

const encoder = new TextEncoder();
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const RATE_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT = 8;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
}

async function hmac(value: string, secret: string): Promise<string> {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function hashOpaqueToken(value: string, secret: string): Promise<string> {
  return hmac(value, secret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  return `pbkdf2_sha256$100000$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, rounds, saltText, expectedText] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || rounds !== "100000" || !saltText || !expectedText) return false;
  try {
    const salt = fromBase64Url(saltText);
    const expected = fromBase64Url(expectedText);
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const saltBuffer = new ArrayBuffer(salt.byteLength);
    new Uint8Array(saltBuffer).set(salt);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: 100_000 }, key, 256));
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a[i % Math.max(a.length, 1)] ?? 0) ^ (b[i % Math.max(b.length, 1)] ?? 0);
  return diff === 0;
}

function isLocalOrigin(env: Env): boolean {
  try { const host = new URL(env.APP_BASE_URL).hostname; return host === "localhost" || host === "127.0.0.1"; }
  catch { return false; }
}

export function cookieName(env: Env): string {
  return isLocalOrigin(env) ? "vpp_session" : "__Host-vpp_session";
}

export function sessionCookie(token: string, env: Env, maxAge = SESSION_SECONDS): string {
  const secure = isLocalOrigin(env) ? "" : " Secure;";
  return `${cookieName(env)}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(env: Env): string {
  return sessionCookie("", env, 0);
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

export function assertSameOrigin<E extends { Bindings: Env }>(c: Context<E>): boolean {
  const origin = c.req.header("Origin");
  if (!origin) return false;
  try {
    // Compare with the actual public request origin. APP_BASE_URL is used for
    // outbound links (verification/reset emails) and may differ from the host
    // currently serving the app (e.g. workers.dev, preview, or custom domain).
    return new URL(origin).origin === new URL(c.req.url).origin;
  } catch {
    return false;
  }
}

export async function enforceRateLimit(env: Env, key: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const keyHash = await hashOpaqueToken(key, env.SESSION_SECRET);
  const row = await env.DB.prepare(`
    INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts)
    VALUES (?, ?, 1)
    ON CONFLICT(key_hash) DO UPDATE SET
      attempts = CASE WHEN auth_rate_limits.window_started_at + ? < excluded.window_started_at THEN 1 ELSE auth_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN auth_rate_limits.window_started_at + ? < excluded.window_started_at THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END
    RETURNING attempts
  `).bind(keyHash, now, RATE_WINDOW_SECONDS, RATE_WINDOW_SECONDS).first<{ attempts: number }>();
  return (row?.attempts ?? RATE_LIMIT + 1) <= RATE_LIMIT;
}

export async function getCurrentUser<E extends { Bindings: Env }>(c: Context<E>): Promise<CurrentUser | null> {
  const token = readCookie(c.req.raw, cookieName(c.env));
  if (!token) return null;
  const tokenHash = await hashOpaqueToken(token, c.env.SESSION_SECRET);
  const row = await c.env.DB.prepare(`
    SELECT u.id, u.email, COALESCE(a.role, 'CUSTOMER') AS role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN admin_users a ON a.user_id = u.id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL
      AND s.expires_at > CURRENT_TIMESTAMP AND u.status = 'ACTIVE'
    LIMIT 1
  `).bind(tokenHash).first<CurrentUser>();
  return row ?? null;
}

export async function requireUser<E extends { Bindings: Env }>(c: Context<E>): Promise<CurrentUser | null> {
  const user = await getCurrentUser(c);
  if (!user) return null;
  return user;
}

export async function requireAdmin<E extends { Bindings: Env }>(c: Context<E>): Promise<CurrentUser | null> {
  const user = await getCurrentUser(c);
  if (!user || !["OWNER", "ADMIN"].includes(user.role)) return null;
  return user;
}

export { SESSION_SECONDS };

import { Hono } from "hono";
import type { Env } from "../types";
import {
  assertSameOrigin, clearSessionCookie, cookieName, enforceRateLimit, hashOpaqueToken,
  hashPassword, randomToken, readCookie, requireUser, sessionCookie, SESSION_SECONDS, verifyPassword
} from "./security";

export const authRoutes = new Hono<{ Bindings: Env }>();

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendVerification(env: Env, email: string, token: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return false;
  const verifyUrl = new URL("/", env.APP_BASE_URL);
  verifyUrl.searchParams.set("verify", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: "تأیید ایمیل حساب کاربری",
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9"><h2>تأیید ایمیل</h2><p>برای فعال‌سازی حساب خود روی لینک زیر بزنید. این لینک تا ۳۰ دقیقه معتبر است.</p><p><a href="${verifyUrl.toString()}">تأیید ایمیل</a></p><p>اگر این درخواست از طرف شما نبوده، این پیام را نادیده بگیرید.</p></div>`
    })
  });
  return response.ok;
}

authRoutes.post("/register", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<{ email?: unknown; password?: unknown; firstName?: unknown; lastName?: unknown }>().catch(() => null);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim().slice(0, 80) : "";
  if (!validEmail(email) || password.length < 12 || password.length > 128 || !firstName || !lastName) {
    return c.json({ error: "INVALID_INPUT", message: "اطلاعات را بررسی کنید. رمز عبور باید حداقل ۱۲ کاراکتر باشد." }, 400);
  }
  if (!await enforceRateLimit(c.env, `register:${email}`)) return c.json({ error: "RATE_LIMITED" }, 429);

  const id = crypto.randomUUID();
  const token = randomToken();
  const tokenHash = await hashOpaqueToken(token, c.env.SESSION_SECRET);
  const passwordHash = await hashPassword(password);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO users (id,email,password_hash,status) VALUES (?,?,?,'PENDING_VERIFICATION')").bind(id, email, passwordHash),
      c.env.DB.prepare("INSERT INTO user_profiles (user_id,first_name,last_name) VALUES (?,?,?)").bind(id, firstName, lastName),
      c.env.DB.prepare("INSERT INTO email_verification_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now','+30 minutes'))").bind(crypto.randomUUID(), id, tokenHash)
    ]);
  } catch {
    return c.json({ error: "EMAIL_ALREADY_REGISTERED", message: "این ایمیل قبلاً ثبت شده یا امکان ساخت حساب وجود ندارد." }, 409);
  }

  const sent = await sendVerification(c.env, email, token).catch(() => false);
  return c.json({
    status: "PENDING_VERIFICATION",
    message: sent ? "لینک تأیید به ایمیل شما ارسال شد." : "حساب ساخته شد، اما ارسال ایمیل فعال نیست. تنظیمات ایمیل باید در Cloudflare تکمیل شود."
  }, 201);
});

authRoutes.post("/verify", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<{ token?: unknown }>().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (token.length < 32 || token.length > 128) return c.json({ error: "INVALID_TOKEN" }, 400);
  const tokenHash = await hashOpaqueToken(token, c.env.SESSION_SECRET);
  const activated = await c.env.DB.prepare(`
    UPDATE users SET status='ACTIVE', updated_at=CURRENT_TIMESTAMP
    WHERE id = (
      SELECT user_id FROM email_verification_tokens
      WHERE token_hash=? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    ) AND status='PENDING_VERIFICATION'
    RETURNING id
  `).bind(tokenHash).first<{ id: string }>();
  if (!activated) return c.json({ error: "TOKEN_INVALID_OR_EXPIRED", message: "لینک تأیید معتبر نیست یا منقضی شده است." }, 400);
  await c.env.DB.prepare("UPDATE email_verification_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL").bind(tokenHash).run();
  return c.json({ status: "ACTIVE", message: "ایمیل تأیید شد. حالا وارد حساب شوید." });
});

authRoutes.post("/login", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<{ email?: unknown; password?: unknown }>().catch(() => null);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!validEmail(email) || !password || password.length > 128) return c.json({ error: "INVALID_CREDENTIALS", message: "ایمیل یا رمز عبور صحیح نیست." }, 401);
  if (!await enforceRateLimit(c.env, `login:${email}`)) return c.json({ error: "RATE_LIMITED", message: "تعداد تلاش‌ها زیاد است. کمی بعد دوباره امتحان کنید." }, 429);
  const record = await c.env.DB.prepare("SELECT id,email,password_hash,status FROM users WHERE email=? LIMIT 1")
    .bind(email).first<{ id: string; email: string; password_hash: string; status: string }>();
  const valid = record ? await verifyPassword(password, record.password_hash) : await verifyPassword(password, "pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!record || !valid) return c.json({ error: "INVALID_CREDENTIALS", message: "ایمیل یا رمز عبور صحیح نیست." }, 401);
  if (record.status !== "ACTIVE") return c.json({ error: "EMAIL_NOT_VERIFIED", message: "ابتدا ایمیل خود را تأیید کنید." }, 403);

  const token = randomToken();
  const tokenHash = await hashOpaqueToken(token, c.env.SESSION_SECRET);
  await c.env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now',?))")
    .bind(crypto.randomUUID(), record.id, tokenHash, `+${SESSION_SECONDS} seconds`).run();
  c.header("Set-Cookie", sessionCookie(token, c.env));
  c.header("Cache-Control", "no-store");
  return c.json({ user: { id: record.id, email: record.email } });
});

authRoutes.post("/logout", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const token = readCookie(c.req.raw, cookieName(c.env));
  if (token) {
    const tokenHash = await hashOpaqueToken(token, c.env.SESSION_SECRET);
    await c.env.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND revoked_at IS NULL").bind(tokenHash).run();
  }
  c.header("Set-Cookie", clearSessionCookie(c.env));
  c.header("Cache-Control", "no-store");
  return c.json({ status: "signed_out" });
});

authRoutes.get("/me", async (c) => {
  const user = await requireUser(c);
  c.header("Cache-Control", "no-store");
  if (!user) return c.json({ user: null }, 401);
  return c.json({ user });
});

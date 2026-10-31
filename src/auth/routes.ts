import { Hono } from "hono";
import { ResendMailer } from "../email/mailer";
import type { Env } from "../types";
import {
  assertSameOrigin, clearSessionCookie, cookieName, enforceRateLimit, hashOpaqueToken,
  hashPassword, randomToken, readCookie, requireUser, sessionCookie, SESSION_SECONDS, verifyPassword
} from "./security";

export const authRoutes = new Hono<{ Bindings: Env }>();
authRoutes.use("/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendVerification(env: Env, email: string, token: string, requestUrl: string): Promise<void> {
  await sendAccountEmail(
    env, email, "تأیید ایمیل حساب Visa Prepaid", "تأیید ایمیل",
    "برای فعال‌سازی حساب، روی دکمه زیر بزنید.",
    "تأیید ایمیل", token, "verify", requestUrl
  );
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
  if (!c.env.RESEND_API_KEY || !c.env.RESEND_FROM_EMAIL) {
    return c.json({ error: "EMAIL_DELIVERY_NOT_CONFIGURED", message: "ثبت‌نام تا زمان تنظیم سرویس ارسال ایمیل فعال نیست." }, 503);
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

  try {
    await sendVerification(c.env, email, token, c.req.url);
  } catch (error) {
    console.error("Registration email delivery failed", error instanceof Error ? error.message : "unknown");
    return c.json({ status: "PENDING_VERIFICATION", message: "حساب ساخته شد اما ایمیل تأیید ارسال نشد. از گزینه ارسال مجدد ایمیل استفاده کنید." }, 201);
  }
  return c.json({ status: "PENDING_VERIFICATION", message: "لینک تأیید به ایمیل شما ارسال شد." }, 201);
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
  const dummyHash = "pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = await verifyPassword(password, record?.password_hash ?? dummyHash);
  if (!record || !valid) return c.json({ error: "INVALID_CREDENTIALS", message: "ایمیل یا رمز عبور صحیح نیست." }, 401);
  if (record.status !== "ACTIVE") return c.json({ error: "EMAIL_NOT_VERIFIED", message: "ابتدا ایمیل خود را تأیید کنید." }, 403);

  const token = randomToken();
  const tokenHash = await hashOpaqueToken(token, c.env.SESSION_SECRET);
  await c.env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now',?))")
    .bind(crypto.randomUUID(), record.id, tokenHash, `+${SESSION_SECONDS} seconds`).run();
  c.header("Set-Cookie", sessionCookie(token, c.env));
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
  return c.json({ status: "signed_out" });
});

authRoutes.get("/me", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ user: null }, 401);
  return c.json({ user });
});
function buildAccountActionUrl(requestUrl: string, queryName: "verify" | "reset", token: string): string {
  // Build links from the actual public origin serving this request. This avoids
  // leaking the local APP_BASE_URL default into production emails.
  const request = new URL(requestUrl);
  const actionUrl = new URL("/", request.origin);
  actionUrl.searchParams.set(queryName, token);
  return actionUrl.toString();
}

function renderAccountEmail(heading: string, description: string, actionLabel: string, actionUrl: string): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 12px;background:#000000;color:#ffffff;font-family:Yekan,'Yekan Bakh',Tahoma,Arial,sans-serif;line-height:1.9">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${heading}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;border-collapse:separate;border-spacing:0">
    <tr><td style="padding:0 0 16px;color:#ffffff;font-size:15px;font-weight:700">VISA PREPAID</td></tr>
    <tr><td style="padding:30px 26px;background:#080808;border:1px solid #292929;border-radius:12px">
      <h1 style="margin:0 0 10px;color:#ffffff;font-size:22px;line-height:1.7;font-weight:700">${heading}</h1>
      <p style="margin:0 0 24px;color:#b0b0b0;font-size:14px;line-height:2">${description}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px"><tr>
        <td align="center" bgcolor="#ffffff" style="border-radius:8px">
          <a href="${actionUrl}" target="_blank" style="display:inline-block;padding:12px 25px;color:#000000;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px">${actionLabel}</a>
        </td>
      </tr></table>
      <p style="margin:0 0 8px;color:#a0a0a0;font-size:11px">اگر دکمه باز نشد، لینک زیر را باز کنید:</p>
      <p dir="ltr" style="margin:0 0 20px;padding:11px 12px;background:#000000;border:1px solid #292929;border-radius:7px;text-align:left;overflow-wrap:anywhere;word-break:break-all;font-size:11px">
        <a href="${actionUrl}" target="_blank" style="color:#ffffff;text-decoration:underline">${actionUrl}</a>
      </p>
      <div style="padding-top:15px;border-top:1px solid #292929;color:#a0a0a0;font-size:11px">
        این لینک تا ۳۰ دقیقه معتبر است.
      </div>
    </td></tr>
    <tr><td align="center" style="padding:18px 10px 0;color:#888888;font-size:10px;line-height:1.9">
      اگر این درخواست از طرف شما نبوده، این ایمیل را نادیده بگیرید.
    </td></tr>
  </table>
</body></html>`;
}

async function sendAccountEmail(env: Env, email: string, subject: string, heading: string, description: string, actionLabel: string, token: string, queryName: "verify" | "reset", requestUrl: string): Promise<void> {
  const actionUrl = buildAccountActionUrl(requestUrl, queryName, token);
  const mailer = new ResendMailer(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  await mailer.send({
    to: email, subject,
    html: renderAccountEmail(heading, description, actionLabel, actionUrl)
  });
}

async function createEmailToken(env: Env, userId: string, table: "email_verification_tokens" | "password_reset_tokens"): Promise<string> {
  const token = randomToken();
  const tokenHash = await hashOpaqueToken(token, env.SESSION_SECRET);
  await env.DB.prepare(`UPDATE ${table} SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL`).bind(userId).run();
  await env.DB.prepare(`INSERT INTO ${table} (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now','+30 minutes'))`)
    .bind(crypto.randomUUID(), userId, tokenHash).run();
  return token;
}


authRoutes.post("/resend-verification", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<{ email?: unknown }>().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!validEmail(email)) return c.json({ error: "INVALID_INPUT", message: "یک ایمیل معتبر وارد کنید." }, 400);
  if (!await enforceRateLimit(c.env, `resend-verification:${email}`)) return c.json({ error: "RATE_LIMITED", message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید." }, 429);
  const user = await c.env.DB.prepare("SELECT id,status FROM users WHERE email=? LIMIT 1").bind(email).first<{ id: string; status: string }>();
  if (!user || user.status !== "PENDING_VERIFICATION") return c.json({ status: "OK", message: "اگر حساب تأییدنشده‌ای با این ایمیل وجود داشته باشد، لینک ارسال خواهد شد." });
  try {
    const token = await createEmailToken(c.env, user.id, "email_verification_tokens");
    await sendAccountEmail(c.env, email, "تأیید ایمیل", "تأیید ایمیل", "برای فعال‌سازی حساب، روی دکمه زیر بزنید.", "تأیید ایمیل", token, "verify", c.req.url);
  } catch (error) {
    console.error("Verification resend failed", error instanceof Error ? error.message : "unknown");
  }
  return c.json({ status: "OK", message: "اگر حساب تأییدنشده‌ای با این ایمیل وجود داشته باشد، لینک ارسال خواهد شد." });
});

// Generic response prevents account enumeration.
authRoutes.post("/forgot-password", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<{ email?: unknown }>().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!validEmail(email)) return c.json({ error: "INVALID_INPUT", message: "یک ایمیل معتبر وارد کنید." }, 400);
  if (!await enforceRateLimit(c.env, `forgot-password:${email}`)) return c.json({ error: "RATE_LIMITED", message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید." }, 429);
  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(email).first<{ id: string }>();
  if (user) {
    try {
      const token = await createEmailToken(c.env, user.id, "password_reset_tokens");
      await sendAccountEmail(c.env, email, "بازیابی رمز عبور", "تغییر رمز عبور", "برای تعیین رمز عبور جدید، روی دکمه زیر بزنید.", "تعیین رمز جدید", token, "reset", c.req.url);
    } catch (error) {
      console.error("Password reset email failed", error instanceof Error ? error.message : "unknown");
    }
  }
  return c.json({ status: "OK", message: "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی ارسال می‌شود." });
});

authRoutes.post("/reset-password", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<{ token?: unknown; password?: unknown }>().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (token.length < 32 || token.length > 128 || password.length < 12 || password.length > 128) {
    return c.json({ error: "INVALID_INPUT", message: "لینک بازیابی یا رمز جدید معتبر نیست. رمز باید حداقل ۱۲ کاراکتر باشد." }, 400);
  }
  const tokenHash = await hashOpaqueToken(token, c.env.SESSION_SECRET);
  if (!await enforceRateLimit(c.env, `reset-password:${tokenHash}`)) return c.json({ error: "RATE_LIMITED", message: "تعداد تلاش‌ها زیاد است. کمی بعد دوباره تلاش کنید." }, 429);
  const user = await c.env.DB.prepare("SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1")
    .bind(tokenHash).first<{ user_id: string }>();
  if (!user) return c.json({ error: "TOKEN_INVALID_OR_EXPIRED", message: "لینک بازیابی معتبر نیست یا منقضی شده است. دوباره درخواست لینک کنید." }, 400);
  const passwordHash = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash=?, status='ACTIVE', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(passwordHash, user.user_id),
    c.env.DB.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL").bind(tokenHash),
    c.env.DB.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL").bind(user.user_id),
    c.env.DB.prepare("UPDATE email_verification_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL").bind(user.user_id),
    c.env.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL").bind(user.user_id)
  ]);
  return c.json({ status: "PASSWORD_RESET", message: "رمز عبور با موفقیت تغییر کرد. حالا می‌توانید وارد شوید." });
});

import { Hono } from "hono";
import { ResendMailer } from "../email/mailer";
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
  const mailer = new ResendMailer(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  await mailer.send({
    to: email,
    subject: "تأیید ایمیل حساب کاربری",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9"><h2>تأیید ایمیل</h2><p>برای فعال‌سازی حساب خود روی لینک زیر بزنید. این لینک تا ۳۰ دقیقه معتبر است.</p><p><a href="${verifyUrl.toString()}">تأیید ایمیل</a></p><p>اگر این درخواست از طرف شما نبوده، این پیام را نادیده بگیرید.</p></div>`
  });
  return true;
}

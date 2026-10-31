import { Hono } from "hono";
import type { Env } from "../types";

const encoder = new TextEncoder();
const MAX_BODY_BYTES = 262144;
const ORDER_EVENTS = new Set(["ORDERS.CREATED", "ORDERS.APPROVED", "ORDERS.CANCELED", "ORDERS.FAILED"]);
type TremendousWebhook = {
  uuid?: unknown; event?: unknown; created_utc?: unknown;
  payload?: { resource?: { id?: unknown; type?: unknown } | null } | null;
};

function jsonError(error: string, status: number, message?: string) {
  return Response.json({ error, ...(message ? { message } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}
async function verifyGatewaySignature(secret: string, rawBody: string, header: string): Promise<boolean> {
  const match = /^sha256=([a-f0-9]{64})$/i.exec(header.trim());
  if (!match || secret.length < 32) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signature = new Uint8Array(match[1].match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
    return await crypto.subtle.verify("HMAC", key, signature, encoder.encode(rawBody));
  } catch { return false; }
}

function classifyEvent(eventType: string): { category: string; actionRequired: boolean; severity: "INFO" | "WARNING" | "CRITICAL"; title: string; message: string } {
  if (eventType.startsWith("ORDERS.")) {
    const failed = eventType === "ORDERS.FAILED" || eventType === "ORDERS.CANCELED";
    return { category: "ORDER", actionRequired: failed, severity: failed ? "WARNING" : "INFO",
      title: failed ? "وضعیت سفارش نیازمند بررسی است" : "رویداد سفارش دریافت شد",
      message: `رویداد ${eventType} از Tremendous دریافت شد.` };
  }
  if (eventType.startsWith("REWARDS.") || eventType.startsWith("REWARD.")) {
    const critical = eventType === "REWARDS.FLAGGED";
    const warning = critical || eventType === "REWARDS.DELIVERY.FAILED" || eventType === "REWARDS.CANCELED";
    return { category: "REWARD", actionRequired: warning, severity: critical ? "CRITICAL" : warning ? "WARNING" : "INFO",
      title: critical ? "Reward علامت‌گذاری شده است" : warning ? "وضعیت Reward نیازمند بررسی است" : "رویداد Reward دریافت شد",
      message: `رویداد ${eventType} از Tremendous دریافت شد؛ وضعیت را در داشبورد تأمین‌کننده بررسی کنید.` };
  }
  if (eventType.startsWith("FRAUD_REVIEWS.")) {
    const blocked = eventType === "FRAUD_REVIEWS.BLOCKED";
    return { category: "FRAUD", actionRequired: true, severity: blocked ? "CRITICAL" : "WARNING",
      title: blocked ? "منبع به دلیل بررسی تقلب مسدود شد" : "وضعیت بررسی تقلب تغییر کرد",
      message: `رویداد امنیتی ${eventType} دریافت شد. اقدام عملیاتی لازم است.` };
  }
  if (eventType.startsWith("FUNDING_SOURCES.") || eventType.startsWith("TOPUPS.")) {
    const urgent = /REVERSED|REJECTED|PARTIALLY_CREDITED/.test(eventType);
    return { category: "FUNDING", actionRequired: urgent, severity: urgent ? "WARNING" : "INFO",
      title: urgent ? "رویداد مالی نیازمند بررسی است" : "رویداد تأمین مالی دریافت شد",
      message: `رویداد مالی ${eventType} دریافت شد؛ این رویداد به‌تنهایی موجودی لحظه‌ای را اثبات نمی‌کند.` };
  }
  if (eventType.startsWith("PRODUCTS.")) {
    const changed = eventType === "PRODUCTS.REMOVED" || eventType === "PRODUCTS.UPDATED";
    return { category: "PRODUCT", actionRequired: changed, severity: changed ? "WARNING" : "INFO",
      title: changed ? "کاتالوگ تأمین‌کننده تغییر کرده است" : "رویداد محصول دریافت شد",
      message: `رویداد ${eventType} دریافت شد؛ کاتالوگ داخلی را در صورت نیاز بازبینی کنید.` };
  }
  return { category: "UNKNOWN", actionRequired: false, severity: "INFO",
    title: "رویداد جدید تأمین‌کننده", message: `نوع رویداد ناشناخته ${eventType} ذخیره شد و اثر خودکاری روی سفارش‌ها ندارد.` };
}

export const tremendousWebhookRoutes = new Hono<{ Bindings: Env }>();
tremendousWebhookRoutes.post("/internal/webhooks/tremendous", async (c) => {
  const secret = c.env.GATEWAY_SHARED_SECRET || "";
  if (secret.length < 32) return jsonError("WEBHOOK_NOT_CONFIGURED", 503, "Gateway shared secret is not configured.");
  const declaredLength = Number(c.req.header("content-length") || "0");
  if (declaredLength > MAX_BODY_BYTES) return jsonError("PAYLOAD_TOO_LARGE", 413);
  const rawBody = await c.req.raw.text();
  if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) return jsonError("PAYLOAD_TOO_LARGE", 413);
  if (!(await verifyGatewaySignature(secret, rawBody, c.req.header("X-Tremendous-Gateway-Signature") || ""))) return jsonError("INVALID_SIGNATURE", 401);
  let payload: TremendousWebhook;
  try { payload = JSON.parse(rawBody) as TremendousWebhook; } catch { return jsonError("INVALID_JSON", 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonError("INVALID_EVENT", 400);

  const eventId = typeof payload.uuid === "string" ? payload.uuid.trim() : "";
  const headerEventId = (c.req.header("Idempotency-Key") || "").trim();
  const eventType = typeof payload.event === "string" ? payload.event.trim().toUpperCase() : "";
  const resourceId = typeof payload.payload?.resource?.id === "string" ? payload.payload.resource.id.trim() : "";
  const resourceType = typeof payload.payload?.resource?.type === "string" ? payload.payload.resource.type.trim().toLowerCase() : "";
  if (!eventId || eventId.length > 200 || !eventType || eventType.length > 120 || resourceId.length > 200) return jsonError("INVALID_EVENT", 400);
  if (!headerEventId || headerEventId !== eventId) return jsonError("IDEMPOTENCY_KEY_MISMATCH", 400);

  const classification = classifyEvent(eventType);
  const eventAt = typeof payload.created_utc === "string" && Number.isFinite(Date.parse(payload.created_utc))
    ? new Date(payload.created_utc).toISOString() : null;
  const attemptId = crypto.randomUUID();
  try {
    const inserted = await c.env.DB.prepare(`
      INSERT OR IGNORE INTO provider_events
        (id,provider,provider_event_id,event_type,resource_type,resource_id,processing_status,
         event_category,action_required,payload_json,resource_created_utc,created_at,updated_at)
      VALUES (?, 'TREMENDOUS', ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(crypto.randomUUID(), eventId, eventType, resourceType || null, resourceId || null,
      classification.category, classification.actionRequired ? 1 : 0, rawBody, eventAt).first<{ id: string }>();

    let eventRowId = inserted?.id;
    if (!eventRowId) {
      const existing = await c.env.DB.prepare("SELECT id,processing_status FROM provider_events WHERE provider='TREMENDOUS' AND provider_event_id=? LIMIT 1")
        .bind(eventId).first<{ id: string; processing_status: string }>();
      if (!existing) return jsonError("EVENT_PERSISTENCE_FAILED", 503);
      if (["PROCESSED", "UNMATCHED", "IGNORED"].includes(existing.processing_status)) {
        return c.json({ received: true, duplicate: true, status: existing.processing_status });
      }
      if (existing.processing_status === "PROCESSING") return jsonError("EVENT_PROCESSING", 503, "The event is already being processed; retry later.");
      eventRowId = existing.id;
      await c.env.DB.prepare("UPDATE provider_events SET payload_json=?,event_category=?,action_required=?,resource_created_utc=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(rawBody, classification.category, classification.actionRequired ? 1 : 0, eventAt, eventRowId).run();
    }

    const claimed = await c.env.DB.prepare(`
      UPDATE provider_events SET processing_status='PROCESSING',last_error=NULL,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND processing_status IN ('RECEIVED','FAILED') RETURNING id
    `).bind(eventRowId).first<{ id: string }>();
    if (!claimed) return jsonError("EVENT_PROCESSING", 503, "The event could not be claimed for processing.");

    const priorAttempts = await c.env.DB.prepare("SELECT COUNT(*) AS total FROM provider_event_attempts WHERE provider_event_row_id=?")
      .bind(eventRowId).first<{ total: number }>();
    const attemptNumber = (priorAttempts?.total || 0) + 1;
    await c.env.DB.prepare("INSERT INTO provider_event_attempts(id,provider_event_row_id,attempt_number,status) VALUES(?,?,?,'PROCESSING')")
      .bind(attemptId, eventRowId, attemptNumber).run();

    try {
      if (ORDER_EVENTS.has(eventType) && resourceType === "orders" && resourceId) {
        const match = await c.env.DB.prepare(`
          SELECT ia.id AS issuance_id, ia.order_id
          FROM issuance_attempts ia JOIN orders o ON o.id=ia.order_id
          WHERE ia.provider_order_id=? AND ia.provider IN ('TREMENDOUS','TREMENDOUS_MANUAL')
          ORDER BY ia.created_at DESC LIMIT 1
        `).bind(resourceId).first<{ issuance_id: string; order_id: string }>();

        if (!match) {
          await c.env.DB.batch([
            c.env.DB.prepare("UPDATE provider_events SET processing_status='UNMATCHED',last_error='ORDER_NOT_LINKED',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(eventRowId),
            c.env.DB.prepare("UPDATE provider_event_attempts SET status='SUCCEEDED',finished_at=CURRENT_TIMESTAMP WHERE id=?").bind(attemptId)
          ]);
          return c.json({ received: true, status: "UNMATCHED", category: classification.category });
        }

        const providerStatus = eventType.slice("ORDERS.".length);
        const failed = eventType === "ORDERS.FAILED" || eventType === "ORDERS.CANCELED";
        await c.env.DB.batch([
          c.env.DB.prepare("UPDATE provider_events SET order_id=?,processing_status='PROCESSED',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(match.order_id, eventRowId),
          c.env.DB.prepare("UPDATE issuance_attempts SET provider_status=?,provider_last_event=?,provider_last_event_at=?,status=CASE WHEN ?=1 THEN 'FAILED' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (provider_last_event_at IS NULL OR provider_last_event_at<=?)").bind(providerStatus, eventType, eventAt || new Date().toISOString(), failed ? 1 : 0, match.issuance_id, eventAt || new Date().toISOString()),
          c.env.DB.prepare("UPDATE orders SET status=CASE WHEN ?=1 AND status IN ('PAID','ISSUING','ISSUED') THEN 'FAILED' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND EXISTS (SELECT 1 FROM issuance_attempts WHERE id=? AND provider_last_event=? AND status='FAILED')").bind(failed ? 1 : 0, match.order_id, match.issuance_id, eventType),
          c.env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(NULL,?,'ORDER',?,?)").bind("TREMENDOUS_WEBHOOK_" + providerStatus, match.order_id, JSON.stringify({ providerEventId: eventId, eventType, resourceId, createdUtc: eventAt }))
        ]);
      } else if (ORDER_EVENTS.has(eventType)) {
        await c.env.DB.prepare("UPDATE provider_events SET processing_status='UNMATCHED',last_error='ORDER_RESOURCE_MISSING',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
          .bind(eventRowId).run();
      } else {
        await c.env.DB.prepare("UPDATE provider_events SET processing_status='PROCESSED',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?")
          .bind(eventRowId).run();
      }

      if (classification.actionRequired) {
        const severity = classification.severity;
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO provider_alerts
            (id,provider,provider_event_row_id,alert_type,severity,title,message,status)
          VALUES (?, 'TREMENDOUS', ?, ?, ?, ?, ?, 'OPEN')
        `).bind(crypto.randomUUID(), eventRowId, eventType, severity, classification.title, classification.message).run();
      }
      await c.env.DB.prepare("UPDATE provider_event_attempts SET status='SUCCEEDED',finished_at=CURRENT_TIMESTAMP WHERE id=?").bind(attemptId).run();
      return c.json({ received: true, status: ORDER_EVENTS.has(eventType) ? "PROCESSED" : "PROCESSED", category: classification.category, actionRequired: classification.actionRequired });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 240) : "PROCESSING_FAILED";
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE provider_events SET processing_status='FAILED',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(message, eventRowId),
        c.env.DB.prepare("UPDATE provider_event_attempts SET status='FAILED',error_message=?,finished_at=CURRENT_TIMESTAMP WHERE id=?").bind(message, attemptId)
      ]).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : "PROCESSING_FAILED";
    console.error("Tremendous webhook processing failed", { eventId, eventType, message });
    return jsonError("PROCESSING_FAILED", 503, "The event could not be processed; the gateway should retry.");
  }
});

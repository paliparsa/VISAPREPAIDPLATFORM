import { Hono } from "hono";
import type { Env } from "../types";
const encoder = new TextEncoder();
const MAX_BODY_BYTES = 262144;
const ORDER_EVENTS = new Set(["ORDERS.CREATED", "ORDERS.APPROVED", "ORDERS.CANCELED", "ORDERS.FAILED"]);
type TremendousWebhook = { uuid?: unknown; event?: unknown; created_utc?: unknown; payload?: { resource?: { id?: unknown; type?: unknown } | null } | null };
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
  const eventId = typeof payload.uuid === "string" ? payload.uuid.trim() : "";
  const headerEventId = (c.req.header("Idempotency-Key") || "").trim();
  const eventType = typeof payload.event === "string" ? payload.event.trim().toUpperCase() : "";
  const resourceId = typeof payload.payload?.resource?.id === "string" ? payload.payload.resource.id.trim() : "";
  const resourceType = typeof payload.payload?.resource?.type === "string" ? payload.payload.resource.type.trim().toLowerCase() : "";
  if (!eventId || eventId.length > 200 || !eventType || eventType.length > 120) return jsonError("INVALID_EVENT", 400);
  if (!headerEventId || headerEventId !== eventId) return jsonError("IDEMPOTENCY_KEY_MISMATCH", 400);
  try {
    const inserted = await c.env.DB.prepare(`
      INSERT OR IGNORE INTO provider_events
        (id,provider,provider_event_id,event_type,resource_type,resource_id,processing_status,created_at,updated_at)
      VALUES (?, 'TREMENDOUS', ?, ?, ?, ?, 'RECEIVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(crypto.randomUUID(), eventId, eventType, resourceType || null, resourceId || null).first<{ id: string }>();
    if (!inserted) {
      const existing = await c.env.DB.prepare("SELECT processing_status FROM provider_events WHERE provider='TREMENDOUS' AND provider_event_id=? LIMIT 1").bind(eventId).first<{ processing_status: string }>();
      if (existing && ["PROCESSED", "UNMATCHED", "IGNORED"].includes(existing.processing_status)) return c.json({ received: true, duplicate: true, status: existing.processing_status });
      if (existing?.processing_status === "PROCESSING") return jsonError("EVENT_PROCESSING", 503, "The event is already being processed; retry later.");
    }
    const claimed = await c.env.DB.prepare(`
      UPDATE provider_events SET processing_status='PROCESSING',last_error=NULL,updated_at=CURRENT_TIMESTAMP
      WHERE provider='TREMENDOUS' AND provider_event_id=? AND processing_status IN ('RECEIVED','FAILED')
      RETURNING id
    `).bind(eventId).first<{ id: string }>();
    if (!claimed) {
      const existing = await c.env.DB.prepare("SELECT processing_status FROM provider_events WHERE provider='TREMENDOUS' AND provider_event_id=? LIMIT 1").bind(eventId).first<{ processing_status: string }>();
      if (existing && ["PROCESSED", "UNMATCHED", "IGNORED"].includes(existing.processing_status)) return c.json({ received: true, duplicate: true, status: existing.processing_status });
      return jsonError("EVENT_PROCESSING", 503, "The event could not be claimed for processing.");
    }
    if (!ORDER_EVENTS.has(eventType) || resourceType !== "orders" || !resourceId) {
      await c.env.DB.prepare("UPDATE provider_events SET processing_status='IGNORED',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE provider='TREMENDOUS' AND provider_event_id=?").bind(eventId).run();
      return c.json({ received: true, status: "IGNORED" });
    }
    const match = await c.env.DB.prepare(`
      SELECT ia.id AS issuance_id, ia.order_id
      FROM issuance_attempts ia JOIN orders o ON o.id=ia.order_id
      WHERE ia.provider_order_id=? AND ia.provider IN ('TREMENDOUS','TREMENDOUS_MANUAL')
      ORDER BY ia.created_at DESC LIMIT 1
    `).bind(resourceId).first<{ issuance_id: string; order_id: string }>();
    if (!match) {
      await c.env.DB.prepare("UPDATE provider_events SET processing_status='UNMATCHED',last_error='ORDER_NOT_LINKED',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE provider='TREMENDOUS' AND provider_event_id=?").bind(eventId).run();
      return c.json({ received: true, status: "UNMATCHED" });
    }
    const providerStatus = eventType.slice("ORDERS.".length);
    const failed = eventType === "ORDERS.FAILED" || eventType === "ORDERS.CANCELED";
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE provider_events SET order_id=?,processing_status='PROCESSED',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,last_error=NULL WHERE provider='TREMENDOUS' AND provider_event_id=?").bind(match.order_id, eventId),
      c.env.DB.prepare("UPDATE issuance_attempts SET provider_status=?,provider_last_event=?,provider_last_event_at=CURRENT_TIMESTAMP,status=CASE WHEN ?=1 THEN 'FAILED' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(providerStatus, eventType, failed ? 1 : 0, match.issuance_id),
      c.env.DB.prepare("UPDATE orders SET status=CASE WHEN ?=1 AND status IN ('PAID','ISSUING','ISSUED') THEN 'FAILED' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(failed ? 1 : 0, match.order_id),
      c.env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(NULL,?,'ORDER',?,?)").bind("TREMENDOUS_WEBHOOK_" + providerStatus, match.order_id, JSON.stringify({ providerEventId: eventId, eventType, resourceId, createdUtc: typeof payload.created_utc === "string" ? payload.created_utc : null }))
    ]);
    return c.json({ received: true, status: "PROCESSED", orderId: match.order_id });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : "PROCESSING_FAILED";
    await c.env.DB.prepare("UPDATE provider_events SET processing_status='FAILED',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE provider='TREMENDOUS' AND provider_event_id=?").bind(message, eventId).run().catch(() => undefined);
    console.error("Tremendous webhook processing failed", { eventId, eventType, message });
    return jsonError("PROCESSING_FAILED", 503, "The event could not be processed; the gateway should retry.");
  }
});

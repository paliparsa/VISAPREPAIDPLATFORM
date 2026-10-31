import { Hono } from "hono";
import type { Env } from "../types";
import { assertSameOrigin, requireAdmin, type CurrentUser } from "../auth/security";
import { encryptProviderSecret, getTremendousRuntimeConfig, readAppSetting } from "../lib/tremendous-config";

type OperationsEnv = { Bindings: Env; Variables: { adminUser: CurrentUser } };
export const operationsRoutes = new Hono<OperationsEnv>();

operationsRoutes.use("/*", async (c, next) => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "FORBIDDEN", message: "دسترسی مدیر لازم است." }, 403);
  c.set("adminUser", user);
  await next();
});

const safeInt = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

operationsRoutes.get("/overview", async (c) => {
  const [users, products, orders, payments, issuance] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) AS active FROM users").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS enabled FROM products").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('PENDING_PAYMENT','AWAITING_PAYMENT') THEN 1 ELSE 0 END) AS awaitingPayment, SUM(CASE WHEN status IN ('PAID','ISSUING','ISSUED','COMPLETED') THEN 1 ELSE 0 END) AS processingOrIssued, SUM(CASE WHEN status IN ('FAILED','CANCELED','CANCELLED') THEN 1 ELSE 0 END) AS failed FROM orders").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('AWAITING','PENDING','CONFIRMING') THEN 1 ELSE 0 END) AS pending FROM payments").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('ISSUED','EXECUTED','COMPLETED') THEN 1 ELSE 0 END) AS issued, SUM(CASE WHEN status IN ('FAILED','ERROR') THEN 1 ELSE 0 END) AS failed FROM issuance_attempts").first()
  ]);
  c.header("Cache-Control", "no-store");
  return c.json({ users, products, orders, payments, issuance });
});

operationsRoutes.get("/orders", async (c) => {
  const page = safeInt(c.req.query("page"), 1, 1, 100000);
  const limit = safeInt(c.req.query("limit"), 20, 10, 50);
  const status = (c.req.query("status") || "").trim().slice(0, 40);
  const q = (c.req.query("q") || "").trim().slice(0, 100);
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (status) { where.push("o.status=?"); binds.push(status); }
  if (q) { where.push("(o.id LIKE ? OR u.email LIKE ? OR o.recipient_email LIKE ?)"); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id=o.user_id ${clause}`).bind(...binds).first<{ total: number }>();
  const { results } = await c.env.DB.prepare(`
    SELECT o.id, o.status, o.recipient_name AS recipientName, o.recipient_email AS recipientEmail,
      o.face_value_minor AS faceValueMinor, o.sale_price_minor AS salePriceMinor, o.currency,
      o.created_at AS createdAt, o.manual_payment_reference AS manualPaymentReference, o.manual_payment_note AS manualPaymentNote, u.email AS customerEmail, p.name AS productName,
      pay.status AS paymentStatus, pay.chain AS paymentChain,
      ia.status AS issuanceStatus, ia.provider_order_id AS providerOrderId, ia.delivery_url AS deliveryUrl, ia.admin_note AS issuanceNote,
      ia.provider_status AS providerStatus, ia.provider_last_event AS providerLastEvent, ia.provider_last_event_at AS providerLastEventAt
    FROM orders o JOIN users u ON u.id=o.user_id
    LEFT JOIN products p ON p.id=o.product_id
    LEFT JOIN payments pay ON pay.order_id=o.id
    LEFT JOIN (SELECT order_id, MAX(created_at) AS latest_created_at FROM issuance_attempts GROUP BY order_id) latest_ia ON latest_ia.order_id=o.id
    LEFT JOIN issuance_attempts ia ON ia.order_id=o.id AND ia.created_at=latest_ia.latest_created_at
    ${clause}
    ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).bind(...binds, limit, (page - 1) * limit).all();
  c.header("Cache-Control", "no-store");
  return c.json({ orders: results, page, limit, total: count?.total ?? 0 });
});

operationsRoutes.get("/customers", async (c) => {
  const page = safeInt(c.req.query("page"), 1, 1, 100000);
  const limit = safeInt(c.req.query("limit"), 20, 10, 50);
  const q = (c.req.query("q") || "").trim().slice(0, 100);
  const where = q ? "WHERE u.email LIKE ? OR COALESCE(up.first_name,'') LIKE ? OR COALESCE(up.last_name,'') LIKE ?" : "";
  const binds = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id ${where}`).bind(...binds).first<{ total: number }>();
  const { results } = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.status, u.created_at AS createdAt,
      up.first_name AS firstName, up.last_name AS lastName, up.country_of_residence AS country,
      COALESCE(a.role,'CUSTOMER') AS role, COUNT(DISTINCT o.id) AS orderCount
    FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id
    LEFT JOIN admin_users a ON a.user_id=u.id
    LEFT JOIN orders o ON o.user_id=u.id
    ${where}
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).bind(...binds, limit, (page - 1) * limit).all();
  c.header("Cache-Control", "no-store");
  return c.json({ customers: results, page, limit, total: count?.total ?? 0 });
});

operationsRoutes.get("/provider-event-summary", async (c) => {
  const [totals, categories, alerts] = await Promise.all([
    c.env.DB.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN processing_status='PROCESSED' THEN 1 ELSE 0 END) AS processed,
        SUM(CASE WHEN processing_status='UNMATCHED' THEN 1 ELSE 0 END) AS unmatched,
        SUM(CASE WHEN processing_status='FAILED' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN processing_status='IGNORED' THEN 1 ELSE 0 END) AS ignored,
        SUM(CASE WHEN processing_status IN ('RECEIVED','PROCESSING') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN action_required=1 THEN 1 ELSE 0 END) AS actionRequired
      FROM provider_events WHERE provider='TREMENDOUS'
    `).first(),
    c.env.DB.prepare(`
      SELECT event_category AS category, COUNT(*) AS total
      FROM provider_events WHERE provider='TREMENDOUS'
      GROUP BY event_category ORDER BY total DESC
    `).all(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS open, SUM(CASE WHEN severity='CRITICAL' THEN 1 ELSE 0 END) AS critical
      FROM provider_alerts WHERE provider='TREMENDOUS' AND status='OPEN'
    `).first()
  ]);
  c.header("Cache-Control", "no-store");
  return c.json({ totals, categories: categories.results, alerts });
});

operationsRoutes.get("/provider-events", async (c) => {
  const limit = safeInt(c.req.query("limit"), 50, 1, 100);
  const status = (c.req.query("status") || "").trim().slice(0, 30);
  const category = (c.req.query("category") || "").trim().slice(0, 30);
  const q = (c.req.query("q") || "").trim().slice(0, 120);
  const allowed = new Set(["RECEIVED", "PROCESSING", "PROCESSED", "UNMATCHED", "IGNORED", "FAILED"]);
  const clauses = ["provider='TREMENDOUS'"];
  const binds: (string | number)[] = [];
  if (status && allowed.has(status)) { clauses.push("processing_status=?"); binds.push(status); }
  if (category) { clauses.push("event_category=?"); binds.push(category); }
  if (q) { clauses.push("(provider_event_id LIKE ? OR event_type LIKE ? OR resource_id LIKE ? OR order_id LIKE ?)"); binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  const { results } = await c.env.DB.prepare(`
    SELECT id,provider_event_id AS eventId,event_type AS eventType,resource_type AS resourceType,
      resource_id AS resourceId,order_id AS orderId,processing_status AS processingStatus,
      event_category AS category,action_required AS actionRequired,last_error AS lastError,
      created_at AS createdAt,processed_at AS processedAt,resource_created_utc AS resourceCreatedUtc
    FROM provider_events WHERE ${clauses.join(" AND ")}
    ORDER BY created_at DESC LIMIT ?
  `).bind(...binds, limit).all();
  c.header("Cache-Control", "no-store");
  return c.json({ events: results, count: results.length });
});

operationsRoutes.get("/provider-events/:id", async (c) => {
  const id = c.req.param("id").slice(0, 100);
  const event = await c.env.DB.prepare(`
    SELECT id,provider_event_id AS eventId,event_type AS eventType,resource_type AS resourceType,
      resource_id AS resourceId,order_id AS orderId,processing_status AS processingStatus,
      event_category AS category,action_required AS actionRequired,last_error AS lastError,
      payload_json AS payloadJson,resource_created_utc AS resourceCreatedUtc,
      created_at AS createdAt,processed_at AS processedAt,updated_at AS updatedAt
    FROM provider_events WHERE provider='TREMENDOUS' AND id=? LIMIT 1
  `).bind(id).first();
  if (!event) return c.json({ error: "PROVIDER_EVENT_NOT_FOUND" }, 404);
  const attempts = await c.env.DB.prepare(`
    SELECT attempt_number AS attemptNumber,status,error_message AS errorMessage,
      started_at AS startedAt,finished_at AS finishedAt
    FROM provider_event_attempts WHERE provider_event_row_id=? ORDER BY attempt_number DESC LIMIT 20
  `).bind(id).all();
  return c.json({ event, attempts: attempts.results });
});

operationsRoutes.get("/provider-alerts", async (c) => {
  const limit = safeInt(c.req.query("limit"), 50, 1, 100);
  const status = (c.req.query("status") || "OPEN").trim().toUpperCase();
  const allowed = new Set(["OPEN", "ACKNOWLEDGED", "RESOLVED", "ALL"]);
  const where = status === "ALL" ? "" : "AND a.status=?";
  const statement = c.env.DB.prepare(`
    SELECT a.id,a.alert_type AS alertType,a.severity,a.title,a.message,a.status,
      a.created_at AS createdAt,a.acknowledged_at AS acknowledgedAt,
      a.provider_event_row_id AS eventRowId,e.provider_event_id AS eventId,
      e.event_type AS eventType,e.resource_id AS resourceId
    FROM provider_alerts a JOIN provider_events e ON e.id=a.provider_event_row_id
    WHERE a.provider='TREMENDOUS' ${where}
    ORDER BY CASE a.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
      a.created_at DESC LIMIT ?
  `);
  const { results } = status === "ALL" || !allowed.has(status)
    ? await statement.bind(limit).all()
    : await statement.bind(status, limit).all();
  return c.json({ alerts: results, count: results.length });
});

operationsRoutes.post("/provider-alerts/:id/acknowledge", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const id = c.req.param("id").slice(0, 100);
  const actor = c.get("adminUser");
  const result = await c.env.DB.prepare(`
    UPDATE provider_alerts SET status='ACKNOWLEDGED',acknowledged_at=CURRENT_TIMESTAMP,acknowledged_by=?
    WHERE id=? AND provider='TREMENDOUS' AND status='OPEN'
  `).bind(actor.id, id).run();
  if ((result.meta.changes ?? 0) !== 1) return c.json({ error: "ALERT_NOT_OPEN_OR_NOT_FOUND" }, 409);
  await c.env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,'PROVIDER_ALERT_ACKNOWLEDGED','PROVIDER_ALERT',?, '{}')")
    .bind(actor.id, id).run();
  return c.json({ status: "ACKNOWLEDGED" });
});

operationsRoutes.get("/provider-automation-rules", async (c) => {
  return c.json({ rules: [
    { id: "order-failed", eventType: "ORDERS.FAILED", action: "CREATE_ALERT", enabled: true, automaticFinancialMutation: false },
    { id: "order-canceled", eventType: "ORDERS.CANCELED", action: "CREATE_ALERT", enabled: true, automaticFinancialMutation: false },
    { id: "reward-flagged", eventType: "REWARDS.FLAGGED", action: "CREATE_CRITICAL_ALERT", enabled: true, automaticFinancialMutation: false },
    { id: "fraud-blocked", eventType: "FRAUD_REVIEWS.BLOCKED", action: "CREATE_CRITICAL_ALERT", enabled: true, automaticFinancialMutation: false },
    { id: "delivery-failed", eventType: "REWARDS.DELIVERY.FAILED", action: "CREATE_ALERT", enabled: true, automaticFinancialMutation: false },
    { id: "funding-reversed", eventType: "TOPUPS.REVERSED", action: "CREATE_ALERT", enabled: true, automaticFinancialMutation: false },
    { id: "product-removed", eventType: "PRODUCTS.REMOVED", action: "CREATE_ALERT", enabled: true, automaticFinancialMutation: false }
  ] });
});

operationsRoutes.get("/activity", async (c) => {
  const limit = safeInt(c.req.query("limit"), 50, 10, 100);
  const { results } = await c.env.DB.prepare(`
    SELECT l.id, l.action, l.entity_type AS entityType, l.entity_id AS entityId,
      l.metadata_json AS metadata, l.created_at AS createdAt, u.email AS actorEmail
    FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_user_id
    ORDER BY l.created_at DESC LIMIT ?
  `).bind(limit).all();
  c.header("Cache-Control", "no-store");
  return c.json({ activity: results });
});

operationsRoutes.get("/settings", async (c) => {
  const [config, hasEncryptionKey, storedKey] = await Promise.all([
    getTremendousRuntimeConfig(c.env).catch(() => null),
    Promise.resolve(Boolean(c.env.ENCRYPTION_KEY)),
    readAppSetting(c.env, "tremendous_api_key").catch(() => null)
  ]);
  return c.json({
    provider: {
      name: "Tremendous",
      mode: config?.mode || (c.env.TREMENDOUS_MODE === "live" ? "live" : "sandbox"),
      apiKeyConfigured: Boolean(config?.apiKey),
      apiKeyManagedInCloudflare: Boolean(c.env.TREMENDOUS_API_KEY && c.env.TREMENDOUS_MODE === "live"),
      storedApiKey: Boolean(storedKey),
      encryptionReady: hasEncryptionKey,
      fundingSourceId: config?.fundingSourceId || "",
      visaProductId: config?.visaProductId || "V4QZ00F554D3"
    },
    payments: {
      enabledChains: (c.env.ENABLED_CHAINS || "").split(",").map((item) => item.trim()).filter(Boolean),
      issuanceMode: c.env.ISSUANCE_MODE || "MANUAL_APPROVAL",
      cryptoMonitoringImplemented: false,
      checkoutImplemented: false,
      liveIssuanceAllowed: false
    }
  });
});

operationsRoutes.post("/settings/provider", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (!c.env.ENCRYPTION_KEY) return c.json({ error: "ENCRYPTION_KEY_REQUIRED", message: "برای ذخیره امن کلید API ابتدا ENCRYPTION_KEY را در Cloudflare به‌صورت Secret تنظیم کنید." }, 503);
  const body = await c.req.json<{ apiKey?: unknown; fundingSourceId?: unknown; visaProductId?: unknown }>().catch(() => null);
  if (!body) return c.json({ error: "INVALID_BODY" }, 400);
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const fundingSourceId = typeof body.fundingSourceId === "string" ? body.fundingSourceId.trim() : "";
  const visaProductId = typeof body.visaProductId === "string" ? body.visaProductId.trim() : "";
  if (apiKey && (apiKey.length < 16 || apiKey.length > 500)) return c.json({ error: "INVALID_API_KEY", message: "کلید API معتبر به نظر نمی‌رسد." }, 400);
  if (fundingSourceId && !/^[A-Za-z0-9_-]{4,80}$/.test(fundingSourceId)) return c.json({ error: "INVALID_FUNDING_SOURCE", message: "شناسه منبع مالی معتبر نیست." }, 400);
  if (visaProductId && !/^[A-Za-z0-9_-]{4,80}$/.test(visaProductId)) return c.json({ error: "INVALID_PRODUCT_ID", message: "شناسه محصول معتبر نیست." }, 400);
  const actor = c.get("adminUser");
  const writes: D1PreparedStatement[] = [];
  const changed: Record<string, unknown> = {};
  if (apiKey) {
    const encrypted = await encryptProviderSecret(apiKey, c.env).catch(() => null);
    if (!encrypted) return c.json({ error: "ENCRYPTION_KEY_INVALID", message: "کلید رمزنگاری باید یک مقدار Base64 معتبر با دقیقاً ۳۲ بایت باشد." }, 503);
    writes.push(c.env.DB.prepare("INSERT INTO app_settings(setting_key,setting_value,updated_by,updated_at) VALUES('tremendous_api_key',?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(encrypted, actor.id));
    changed.apiKeyUpdated = true;
  }
  if (fundingSourceId) {
    writes.push(c.env.DB.prepare("INSERT INTO app_settings(setting_key,setting_value,updated_by,updated_at) VALUES('tremendous_funding_source_id',?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(fundingSourceId, actor.id));
    changed.fundingSourceId = fundingSourceId;
  }
  if (visaProductId) {
    writes.push(c.env.DB.prepare("INSERT INTO app_settings(setting_key,setting_value,updated_by,updated_at) VALUES('tremendous_visa_product_id',?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(visaProductId, actor.id));
    changed.visaProductId = visaProductId;
  }
  if (!writes.length) return c.json({ error: "NO_CHANGES", message: "حداقل یک مقدار جدید وارد کنید." }, 400);
  writes.push(c.env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?, 'PROVIDER_SETTINGS_UPDATED','PROVIDER','TREMENDOUS',?)").bind(actor.id, JSON.stringify(changed)));
  await c.env.DB.batch(writes);
  return c.json({ status: "saved", message: "تنظیمات ارائه‌دهنده با رمزنگاری ذخیره شد." });
});

operationsRoutes.post("/provider/test", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const config = await getTremendousRuntimeConfig(c.env).catch(() => null);
  if (!config?.apiKey) return c.json({ error: "PROVIDER_NOT_CONFIGURED", message: "ابتدا کلید API را ذخیره کنید." }, 400);
  const base = config.mode === "live" ? "https://api.tremendous.com/api/v2" : "https://testflight.tremendous.com/api/v2";
  let response: Response;
  try {
    response = await fetch(`${base}/funding_sources`, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" }
    });
  } catch {
    return c.json({ error: "PROVIDER_UNREACHABLE", message: "ارتباط با Tremendous برقرار نشد. شبکه یا تنظیمات را بررسی کنید." }, 502);
  }
  if (!response.ok) {
    const message = response.status === 401 ? "کلید API رد شد یا به این محیط تعلق ندارد."
      : response.status === 403 ? "این کلید اجازه خواندن اطلاعات حساب را ندارد."
        : response.status === 429 ? "محدودیت درخواست Tremendous فعال شده است. کمی بعد دوباره تلاش کنید."
          : `پاسخ Tremendous ناموفق بود (HTTP ${response.status}).`;
    return c.json({ error: "PROVIDER_TEST_FAILED", message }, response.status === 429 ? 429 : 502);
  }
  const payload = await response.json().catch(() => null) as { funding_sources?: Array<{ id?: string; method?: string; status?: string; usage_permissions?: string[]; meta?: { available_cents?: number } }> } | null;
  const sources = (payload?.funding_sources || []).map((source) => ({
    id: source.id || "",
    method: source.method || "unknown",
    status: source.status || "unknown",
    canPayApiOrders: Boolean(source.usage_permissions?.includes("api_orders")),
    availableCents: Number.isFinite(source.meta?.available_cents) ? source.meta?.available_cents : null
  }));
  return c.json({ connected: true, mode: config.mode, fundingSources: sources });
});


// Manual operations: no provider API call is made by either action below.
operationsRoutes.post("/orders/:id/confirm-payment", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const orderId = c.req.param("id").slice(0, 100);
  const body = await c.req.json<{ reference?: unknown; note?: unknown }>().catch(() => null);
  const reference = typeof body?.reference === "string" ? body.reference.trim().slice(0, 160) : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (reference.length < 3) return c.json({ error: "PAYMENT_REFERENCE_REQUIRED", message: "شناسه یا مرجع قابل استناد پرداخت را وارد کنید." }, 400);
  const actor = c.get("adminUser");
  const current = await c.env.DB.prepare("SELECT id,status FROM orders WHERE id=? LIMIT 1").bind(orderId).first<{id:string;status:string}>();
  if (!current) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (current.status !== "PENDING_PAYMENT" && current.status !== "AWAITING_PAYMENT") return c.json({ error: "ORDER_STATE_CONFLICT", message: "این سفارش در وضعیت قابل تأیید پرداخت نیست." }, 409);
  const results = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE orders SET status='PAID',manual_payment_reference=?,manual_payment_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('PENDING_PAYMENT','AWAITING_PAYMENT')").bind(reference, note || null, orderId),
    c.env.DB.prepare("UPDATE payments SET status='MANUALLY_CONFIRMED' WHERE order_id=? AND status IN ('AWAITING','PENDING','CONFIRMING')").bind(orderId),
    c.env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) SELECT ?, 'PAYMENT_MANUALLY_CONFIRMED','ORDER',?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=? AND status='PAID' AND manual_payment_reference=?)").bind(actor.id, orderId, JSON.stringify({ reference, note }), orderId, reference)
  ]);
  if ((results[0].meta.changes ?? 0) !== 1) return c.json({ error: "ORDER_STATE_CONFLICT", message: "وضعیت سفارش هم‌زمان تغییر کرده است؛ صفحه را تازه کنید." }, 409);
  return c.json({ status: "PAID", message: "پرداخت با ثبت مرجع و تأیید مدیر ثبت شد." });
});

operationsRoutes.post("/orders/:id/manual-issuance", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const orderId = c.req.param("id").slice(0, 100);
  const body = await c.req.json<{ providerOrderId?: unknown; deliveryUrl?: unknown; note?: unknown }>().catch(() => null);
  const providerOrderId = typeof body?.providerOrderId === "string" ? body.providerOrderId.trim().slice(0, 160) : "";
  const deliveryUrl = typeof body?.deliveryUrl === "string" ? body.deliveryUrl.trim().slice(0, 1000) : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!providerOrderId) return c.json({ error: "PROVIDER_ORDER_ID_REQUIRED", message: "شناسه سفارش صادرشده در Tremendous الزامی است." }, 400);
  if (deliveryUrl) { try { const url = new URL(deliveryUrl); if (url.protocol !== "https:") throw new Error(); } catch { return c.json({ error: "INVALID_DELIVERY_URL", message: "لینک تحویل باید یک آدرس HTTPS معتبر باشد." }, 400); } }
  const actor = c.get("adminUser");
  const order = await c.env.DB.prepare("SELECT id,status FROM orders WHERE id=? LIMIT 1").bind(orderId).first<{id:string;status:string}>();
  if (!order) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (order.status !== "PAID" && order.status !== "ISSUING") return c.json({ error: "ORDER_NOT_PAID", message: "ابتدا پرداخت سفارش را پس از بررسی مستقل تأیید کنید." }, 409);
  const attemptId = crypto.randomUUID();
  const externalId = `manual_${crypto.randomUUID()}`;
  const results = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE orders SET status='ISSUED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('PAID','ISSUING')").bind(orderId),
    c.env.DB.prepare("INSERT INTO issuance_attempts(id,order_id,provider,external_id,provider_order_id,status,delivery_url,admin_note,processed_by,updated_at) SELECT ?,?,'TREMENDOUS_MANUAL',?,?, 'ISSUED',?,?,?,CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM orders WHERE id=? AND status='ISSUED')").bind(attemptId, orderId, externalId, providerOrderId, deliveryUrl || null, note || null, actor.id, orderId),
    c.env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) SELECT ?, 'MANUAL_CARD_ISSUED','ORDER',?,? WHERE EXISTS (SELECT 1 FROM issuance_attempts WHERE id=?)").bind(actor.id, orderId, JSON.stringify({ provider: "TREMENDOUS_MANUAL", providerOrderId, deliveryUrl: Boolean(deliveryUrl), note }), attemptId)
  ]);
  if ((results[0].meta.changes ?? 0) !== 1 || (results[1].meta.changes ?? 0) !== 1) return c.json({ error: "ORDER_STATE_CONFLICT", message: "وضعیت سفارش هم‌زمان تغییر کرده است؛ صفحه را تازه کنید." }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE issuance_attempts SET
        provider_status=(SELECT SUBSTR(event_type,8) FROM provider_events WHERE provider='TREMENDOUS' AND resource_type='orders' AND resource_id=? AND processing_status='UNMATCHED' ORDER BY created_at DESC LIMIT 1),
        provider_last_event=(SELECT event_type FROM provider_events WHERE provider='TREMENDOUS' AND resource_type='orders' AND resource_id=? AND processing_status='UNMATCHED' ORDER BY created_at DESC LIMIT 1),
        provider_last_event_at=(SELECT strftime('%Y-%m-%dT%H:%M:%fZ',created_at) FROM provider_events WHERE provider='TREMENDOUS' AND resource_type='orders' AND resource_id=? AND processing_status='UNMATCHED' ORDER BY created_at DESC LIMIT 1)
      WHERE id=? AND EXISTS (SELECT 1 FROM provider_events WHERE provider='TREMENDOUS' AND resource_type='orders' AND resource_id=? AND processing_status='UNMATCHED')
    `).bind(providerOrderId, providerOrderId, providerOrderId, attemptId, providerOrderId),
    c.env.DB.prepare(`
      UPDATE orders SET status='FAILED',updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND EXISTS (
        SELECT 1 FROM provider_events pe
        WHERE pe.provider='TREMENDOUS' AND pe.resource_type='orders' AND pe.resource_id=?
          AND pe.processing_status='UNMATCHED' AND pe.event_type IN ('ORDERS.FAILED','ORDERS.CANCELED')
          AND pe.created_at=(SELECT MAX(created_at) FROM provider_events WHERE provider='TREMENDOUS' AND resource_type='orders' AND resource_id=? AND processing_status='UNMATCHED')
      )
    `).bind(orderId, providerOrderId, providerOrderId),
    c.env.DB.prepare(`
      UPDATE provider_events SET order_id=?,processing_status='PROCESSED',processed_at=COALESCE(processed_at,CURRENT_TIMESTAMP),
        updated_at=CURRENT_TIMESTAMP,last_error=NULL
      WHERE provider='TREMENDOUS' AND resource_type='orders' AND resource_id=? AND processing_status='UNMATCHED'
    `).bind(orderId, providerOrderId),
    c.env.DB.prepare(`
      INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json)
      SELECT ?, 'TREMENDOUS_WEBHOOK_RECONCILED','ORDER',?,?
      WHERE EXISTS (SELECT 1 FROM provider_events WHERE provider='TREMENDOUS' AND order_id=? AND resource_id=?)
    `).bind(actor.id, orderId, JSON.stringify({ providerOrderId }), orderId, providerOrderId)
  ]);
  return c.json({ status: "ISSUED", message: "صدور دستی ثبت شد؛ وب‌هوک‌های قبلی این سفارش نیز در صورت وجود تطبیق داده شدند." });
});

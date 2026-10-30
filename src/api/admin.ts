import { Hono } from "hono";
import type { Env } from "../types";
import { assertSameOrigin, constantTimeEqual, requireAdmin } from "../auth/security";

export const adminRoutes = new Hono<{ Bindings: Env }>();
export const adminBootstrapRoutes = new Hono<{ Bindings: Env }>();

async function validBootstrapToken(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  return constantTimeEqual(new Uint8Array(a), new Uint8Array(b));
}


function validateProduct(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const providerProductId = typeof body.providerProductId === "string" ? body.providerProductId.trim().slice(0, 120) : "";
  const faceValueMinor = Number(body.faceValueMinor);
  const salePriceMinor = Number(body.salePriceMinor);
  const sortOrder = Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const enabled = body.enabled === true;
  if (!name || !providerProductId || !Number.isInteger(faceValueMinor) || faceValueMinor < 100 || faceValueMinor > 1_000_000 ||
      !Number.isInteger(salePriceMinor) || salePriceMinor < faceValueMinor || salePriceMinor > 2_000_000 ||
      !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) return null;
  return { name, description, providerProductId, faceValueMinor, salePriceMinor, sortOrder, enabled };
}

adminRoutes.use("/*", async (c, next) => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "FORBIDDEN", message: "دسترسی مدیر لازم است." }, 403);
  await next();
});

adminRoutes.get("/products", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, provider, provider_product_id AS providerProductId, name, description,
      currency, face_value_minor AS faceValueMinor, sale_price_minor AS salePriceMinor,
      enabled, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
    FROM products ORDER BY sort_order ASC, created_at DESC LIMIT 100
  `).all();
  return c.json({ products: results });
});

adminRoutes.post("/products", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const product = body && validateProduct(body);
  if (!product) return c.json({ error: "INVALID_PRODUCT", message: "اطلاعات محصول یا قیمت را بررسی کنید." }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO products (id,provider,provider_product_id,name,description,currency,face_value_minor,sale_price_minor,enabled,sort_order)
    VALUES (?,'TREMENDOUS',?,?,?,'USD',?,?,?,?)
  `).bind(id, product.providerProductId, product.name, product.description || null, product.faceValueMinor, product.salePriceMinor, product.enabled ? 1 : 0, product.sortOrder).run();
  return c.json({ id, status: "created" }, 201);
});

adminRoutes.put("/products/:id", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const product = body && validateProduct(body);
  if (!product) return c.json({ error: "INVALID_PRODUCT", message: "اطلاعات محصول یا قیمت را بررسی کنید." }, 400);
  const result = await c.env.DB.prepare(`
    UPDATE products SET provider_product_id=?,name=?,description=?,face_value_minor=?,sale_price_minor=?,enabled=?,sort_order=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(product.providerProductId, product.name, product.description || null, product.faceValueMinor, product.salePriceMinor, product.enabled ? 1 : 0, product.sortOrder, c.req.param("id")).run();
  if ((result.meta.changes ?? 0) !== 1) return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
  return c.json({ status: "updated" });
});

adminRoutes.delete("/products/:id", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const result = await c.env.DB.prepare("UPDATE products SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(c.req.param("id")).run();
  if ((result.meta.changes ?? 0) !== 1) return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
  return c.json({ status: "disabled" });
});

adminBootstrapRoutes.post("/bootstrap", async (c) => {
  if (!assertSameOrigin(c)) return c.json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = await c.req.json<{ email?: unknown; token?: unknown }>().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const token = typeof body?.token === "string" ? body.token : "";
  if (!await validBootstrapToken(token, c.env.ADMIN_BOOTSTRAP_TOKEN || "")) return c.json({ error: "BOOTSTRAP_NOT_ALLOWED" }, 403);
  const result = await c.env.DB.prepare(`
    INSERT INTO admin_users (user_id, role)
    SELECT id, 'OWNER' FROM users
    WHERE email=? AND status='ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM admin_users)
  `).bind(email).run();
  if ((result.meta.changes ?? 0) !== 1) return c.json({ error: "BOOTSTRAP_UNAVAILABLE", message: "حساب فعال پیدا نشد یا مدیر اصلی قبلاً ساخته شده است." }, 409);
  return c.json({ status: "OWNER_CREATED", message: "دسترسی مدیر اصلی فعال شد. دوباره وارد حساب شوید." }, 201);
});

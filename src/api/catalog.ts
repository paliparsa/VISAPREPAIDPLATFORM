import { Hono } from "hono";
import type { Env } from "../types";

export const catalogRoutes = new Hono<{ Bindings: Env }>();
catalogRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, name, description, currency,
      face_value_minor AS faceValueMinor, sale_price_minor AS salePriceMinor
    FROM products WHERE enabled=1 ORDER BY sort_order ASC, created_at DESC LIMIT 50
  `).all();
  c.header("Cache-Control", "no-store");
  return c.json({ products: results });
});

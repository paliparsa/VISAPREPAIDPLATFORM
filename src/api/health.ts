import { Hono } from "hono";
import type { Env } from "../types";
export const healthRoutes = new Hono<{ Bindings: Env }>();
healthRoutes.get("/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ status: "ok", database: "reachable", environment: c.env.APP_ENV });
  } catch {
    return c.json({ status: "degraded", database: "unavailable" }, 503);
  }
});
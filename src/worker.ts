import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { healthRoutes } from "./api/health";
import { authRoutes } from "./auth/routes";
import { adminRoutes } from "./api/admin";
import { catalogRoutes } from "./api/catalog";

const app = new Hono<{ Bindings: Env }>();
app.use("/api/*", cors({
  origin: (origin, c) => {
    try { return origin && new URL(origin).origin === new URL(c.env.APP_BASE_URL).origin ? origin : ""; }
    catch { return ""; }
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  credentials: true
}));
app.route("/api", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/catalog", catalogRoutes);
app.notFound((c) => c.json({ error: "NOT_FOUND" }, 404));
app.onError((error, c) => {
  console.error("Unhandled request", error.name);
  return c.json({ error: "INTERNAL_ERROR" }, 500);
});
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(env.JOBS.send({ type: "CHAIN_MONITOR_TICK", at: Date.now() }));
  },
  async queue(batch: MessageBatch<unknown>) {
    for (const message of batch.messages) message.ack();
  }
};

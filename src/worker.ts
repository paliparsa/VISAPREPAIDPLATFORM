import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { healthRoutes } from "./api/health";

const app = new Hono<{ Bindings: Env }>();
app.use("/api/*", cors({
  origin: (origin, c) => origin === c.env.APP_BASE_URL ? origin : "",
  allowMethods: ["GET", "POST"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.route("/api", healthRoutes);
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
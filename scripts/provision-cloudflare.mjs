import { readFile, writeFile } from "node:fs/promises";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");

const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
async function cf(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const errors = (payload.errors || []).map((item) => item.message).join("; ");
    throw new Error(`Cloudflare API ${response.status} ${path}: ${errors || response.statusText}`);
  }
  return payload.result;
}

async function ensureD1(name) {
  const databases = await cf("/d1/database");
  const existing = databases.find((item) => item.name === name);
  if (existing) {
    console.log(`D1 database exists: ${name}`);
    return existing.uuid;
  }
  const created = await cf("/d1/database", { method: "POST", body: JSON.stringify({ name }) });
  console.log(`Created D1 database: ${name}`);
  return created.uuid;
}

async function ensureR2(name) {
  const response = await cf("/r2/buckets");
  const buckets = response.buckets || response;
  if (buckets.some((item) => item.name === name)) {
    console.log(`R2 bucket exists: ${name}`);
    return;
  }
  await cf("/r2/buckets", { method: "POST", body: JSON.stringify({ name }) });
  console.log(`Created R2 bucket: ${name}`);
}

async function ensureQueue(name) {
  const queues = await cf("/queues");
  if (queues.some((item) => item.queue_name === name || item.queueName === name)) {
    console.log(`Queue exists: ${name}`);
    return;
  }
  await cf("/queues", { method: "POST", body: JSON.stringify({ queue_name: name }) });
  console.log(`Created Queue: ${name}`);
}

const configPath = "wrangler.jsonc";
const config = JSON.parse(await readFile(configPath, "utf8"));
const database = config.d1_databases?.find((item) => item.binding === "DB");
if (!database) throw new Error("wrangler.jsonc must define the DB D1 binding.");
database.database_id = await ensureD1(database.database_name);
config.account_id = accountId;

for (const bucket of config.r2_buckets || []) await ensureR2(bucket.bucket_name);
for (const producer of config.queues?.producers || []) await ensureQueue(producer.queue);
for (const consumer of config.queues?.consumers || []) {
  if (consumer.dead_letter_queue) await ensureQueue(consumer.dead_letter_queue);
}

config.vars = {
  ...config.vars,
  APP_ENV: "production",
  APP_BASE_URL: process.env.APP_BASE_URL,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  TREMENDOUS_MODE: process.env.TREMENDOUS_MODE || "sandbox"
};
if (!config.vars.APP_BASE_URL || !config.vars.RESEND_FROM_EMAIL) {
  throw new Error("APP_BASE_URL and RESEND_FROM_EMAIL GitHub variables are required.");
}

await writeFile(".wrangler.generated.jsonc", `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log("Cloudflare resources are ready; generated deployment config.");

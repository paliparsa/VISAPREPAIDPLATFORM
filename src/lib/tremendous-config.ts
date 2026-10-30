import type { Env } from "../types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function encryptionKey(env: Env): Promise<CryptoKey> {
  if (!env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY_NOT_CONFIGURED");
  const raw = decodeBase64(env.ENCRYPTION_KEY);
  if (raw.byteLength !== 32) throw new Error("ENCRYPTION_KEY_INVALID");
  const buffer = new ArrayBuffer(raw.byteLength);
  new Uint8Array(buffer).set(raw);
  return crypto.subtle.importKey("raw", buffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptProviderSecret(value: string, env: Env): Promise<string> {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivBuffer = new ArrayBuffer(iv.byteLength);
  new Uint8Array(ivBuffer).set(iv);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBuffer }, key, encoder.encode(value));
  return `${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptProviderSecret(value: string, env: Env): Promise<string> {
  const [ivText, encryptedText] = value.split(".");
  if (!ivText || !encryptedText) throw new Error("ENCRYPTED_SECRET_INVALID");
  const key = await encryptionKey(env);
  const iv = decodeBase64(ivText);
  const encrypted = decodeBase64(encryptedText);
  const ivBuffer = new ArrayBuffer(iv.byteLength);
  const encryptedBuffer = new ArrayBuffer(encrypted.byteLength);
  new Uint8Array(ivBuffer).set(iv);
  new Uint8Array(encryptedBuffer).set(encrypted);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuffer }, key, encryptedBuffer);
  return decoder.decode(plaintext);
}

export async function readAppSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT setting_value FROM app_settings WHERE setting_key=? LIMIT 1")
    .bind(key).first<{ setting_value: string }>();
  return row?.setting_value ?? null;
}

export interface TremendousRuntimeConfig {
  apiKey: string;
  mode: "sandbox" | "live";
  fundingSourceId: string;
  visaProductId: string;
}

export async function getTremendousRuntimeConfig(env: Env): Promise<TremendousRuntimeConfig> {
  const [storedCipher, storedFundingSource, storedProduct] = await Promise.all([
    readAppSetting(env, "tremendous_api_key"),
    readAppSetting(env, "tremendous_funding_source_id"),
    readAppSetting(env, "tremendous_visa_product_id")
  ]);
  const mode = env.TREMENDOUS_MODE === "live" ? "live" : "sandbox";
  let storedApiKey = "";
  if (storedCipher) storedApiKey = await decryptProviderSecret(storedCipher, env);
  // In live mode, an explicitly provisioned Cloudflare secret takes precedence.
  const apiKey = mode === "live" ? (env.TREMENDOUS_API_KEY || storedApiKey) : (storedApiKey || env.TREMENDOUS_API_KEY || "");
  return {
    apiKey,
    mode,
    fundingSourceId: storedFundingSource || env.TREMENDOUS_FUNDING_SOURCE_ID || "",
    visaProductId: storedProduct || env.TREMENDOUS_VISA_PRODUCT_ID || "V4QZ00F554D3"
  };
}

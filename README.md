# Visa Prepaid Platform

Cloudflare-native Persian-language virtual prepaid card storefront and operations console. The service is intended only for recipients who meet the issuer/provider's actual country and product eligibility requirements.

## Stack
- Cloudflare Workers + Hono API
- React + Vite Persian RTL storefront and admin console
- Cloudflare D1 database, R2 private storage, Queues and Cron
- Resend transactional email
- Tremendous API v2 adapter with encrypted admin-managed Sandbox credentials
- Planned chain integrations: TRON/TRC20, Ethereum/ERC20, BNB Smart Chain/BEP20 (not active)

## Implemented
- Customer registration, email verification, login/logout, revocable sessions, and secure password recovery.
- Server-authorized OWNER/ADMIN product catalog management with audit events.
- Operations dashboard with customer/order overview, paginated order and customer lists, provider settings, connection test, payment configuration status, and audit activity.
- Signed Tremendous Gateway webhook receiver with idempotent event persistence, order correlation, provider-status tracking, and an admin webhook activity view.
- Audited manual fulfillment for existing orders: admins can record independently verified payment references, then record a Tremendous dashboard order ID, optional HTTPS delivery link, and internal note. The flow never calls Tremendous to create a reward.
- Tremendous API key can be saved by an OWNER/ADMIN; it is encrypted at rest with AES-GCM using the Cloudflare-only `ENCRYPTION_KEY`.
- Tremendous Sandbox connection test reads funding sources and reports whether they are active and allowed for API orders.
- Live issuance requires both `TREMENDOUS_MODE=live` and `ISSUANCE_MODE=LIVE_APPROVED`; the admin UI cannot enable it.

## Not implemented / not enabled
- Crypto deposit address allocation, on-chain payment monitoring, and payment reconciliation.
- Customer order placement and checkout (therefore the manual workflow currently applies only to order records already present in D1).
- Customer-facing order history and card-delivery display.
- Automated customer payment verification and payment-to-issuance linking.
- Full automated unit, integration, and browser tests.

## Important provider restriction
Tremendous production-access documentation lists crypto-related businesses among prohibited business types. Do not use Tremendous for a USDT-funded checkout or enable live issuance unless Tremendous has explicitly approved the exact operating entity and business model in writing. A Persian-language storefront does not change provider eligibility or policy. See [Tremendous production API access](https://developers.tremendous.com/docs/production-api-access).

## Tremendous Gateway connection

The main Worker receives Gateway-forwarded events at `POST /api/internal/webhooks/tremendous`. Configure the Gateway Worker with `UPSTREAM_URL=https://YOUR_MAIN_APP_HOST/api/internal/webhooks/tremendous` and `UPSTREAM_SECRET` equal to this Worker's `GATEWAY_SHARED_SECRET`. The Gateway signs the exact raw JSON body with HMAC-SHA256 and sends `X-Tremendous-Gateway-Signature: sha256=...` plus `Idempotency-Key` equal to the Tremendous webhook UUID. Never expose this shared secret in the browser or commit it to Git.

The receiver only correlates `ORDERS.*` events whose resource type is `orders` with a previously recorded provider order ID. It records all valid event IDs for deduplication. Unknown event types are retained as ignored, and order events without a matching issuance record are retained as unmatched. `ORDERS.CANCELED` and `ORDERS.FAILED` can mark a matched order failed; created/approved events only update provider-side status. No webhook confirms customer payment or creates/issues a reward.

## Local development
1. Run `npm install`.
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Set `SESSION_SECRET`, `ENCRYPTION_KEY` (Base64 for 32 random bytes), `ADMIN_BOOTSTRAP_TOKEN`, and valid Resend settings.
4. Apply migrations with `npm run db:migrate:local`.
5. Start the Worker with `npx wrangler dev --port 8787` and the frontend with `npm run dev`.

## Cloudflare deployment
Connect the repository from **Cloudflare Dashboard → Workers & Pages → Worker → Settings → Builds → Connect**. Use root directory `/`, build command `npm run build`, and deploy command `npm run deploy`. Wrangler provisions declared resources and applies pending D1 migrations.

### Worker secrets
- `SESSION_SECRET`: random value, at least 32 characters.
- `ENCRYPTION_KEY`: Base64-encoded 32-byte key; generate with `openssl rand -base64 32`. Required to save API credentials from the admin console.
- `ADMIN_BOOTSTRAP_TOKEN`: one-time owner bootstrap secret; remove after setup.
- `RESEND_API_KEY`: Resend API key.
- `TREMENDOUS_API_KEY`: optional Cloudflare-managed key; Live mode only uses this key in preference to the encrypted Sandbox key.
- `GATEWAY_SHARED_SECRET`: random secret of at least 32 characters, shared only with the Gateway `UPSTREAM_SECRET`.

### Worker variables
- `APP_BASE_URL`: exact public HTTPS origin.
- `APP_ENV`: `production`.
- `RESEND_FROM_EMAIL`: verified sender address.
- `TREMENDOUS_MODE`: keep `sandbox`.
- `ISSUANCE_MODE`: keep `MANUAL_APPROVAL`.
- `ENABLED_CHAINS`: informational until payment monitoring is implemented.

Cloudflare-managed secrets are never committed to GitHub. `keep_vars: true` preserves dashboard-managed variables across deploys.

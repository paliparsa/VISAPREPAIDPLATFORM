# Visa Prepaid Platform

Cloudflare-native platform for a Persian-language virtual prepaid card storefront and operations console. The service is intended for recipients who meet the issuer/provider's actual country and product eligibility requirements.

## Stack
- Cloudflare Workers + Hono API
- React + Vite Persian RTL storefront and admin catalog
- Cloudflare D1 database
- Cloudflare R2 private object storage
- Cloudflare Queues + Cron background jobs
- Planned USDT payment monitoring: TRON/TRC20, Ethereum/ERC20, BNB Smart Chain/BEP20
- Resend transactional email
- Tremendous API v2 provider adapter (sandbox-first; live issuance remains gated)

## Implemented
- Customer registration with email verification, sign-in, sign-out, and revocable opaque sessions.
- PBKDF2-HMAC-SHA-256 password hashing (100,000 iterations); raw session and verification tokens are not stored in D1.
- Email-scoped authentication rate limiting and same-origin checks for state-changing requests.
- One-time owner bootstrap requiring an active verified account and a Cloudflare secret.
- Admin product catalog create/edit/list/disable API, with server-side OWNER/ADMIN checks.
- Public catalog of enabled products.
- Persian RTL account and catalog-management UI.
- Tremendous API v2 adapter for Virtual Visa order creation/status lookup.

## Not implemented yet
- Customer order placement and checkout.
- Crypto deposit address allocation and on-chain payment verification.
- Automated reconciliation and payment confirmation.
- Connecting successful payments to Tremendous issuance.
- Card delivery, customer card/order history, refunds, and production operations monitoring.
- Full automated unit, integration, and browser tests.

## Provider and eligibility
See [provider integration setup](docs/provider-integration.md). The API recipient name is metadata and is not a guarantee of a custom cardholder name. Recipient country and product eligibility must be checked against the provider's current rules. A Persian storefront does not imply that all recipient locations are supported.

## Local development

1. Install dependencies: `npm install`
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Set a random `SESSION_SECRET` of at least 32 characters, a long random `ADMIN_BOOTSTRAP_TOKEN`, and valid Resend API key/from address.
4. Create the local D1 database and apply migrations: `npm run db:migrate:local`.
5. Start the Worker in one terminal: `npx wrangler dev --port 8787`.
6. Start the frontend in another terminal: `npm run dev` (Vite proxies `/api` to port 8787).

## Cloudflare setup
- Create the D1, R2, and Queue resources referenced by `wrangler.jsonc`.
- Replace the D1 database ID placeholder.
- Set Worker secrets: `SESSION_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `RESEND_API_KEY`, `TREMENDOUS_API_KEY` (when ready).
- Set Worker variables: `APP_BASE_URL` to the exact HTTPS production origin, `APP_ENV=production`, `RESEND_FROM_EMAIL`, `TREMENDOUS_MODE=sandbox`, and the funding/product IDs when provider access is approved.
- Apply remote migrations with `npm run db:migrate:remote`.
- Deploy only after CI passes and resource bindings/secrets are configured.

Never commit credentials, wallet seed phrases, or private keys. Never enable real card issuance or crypto payments before provider approval, eligibility enforcement, legal/compliance review, and end-to-end testing.

## First administrator
1. Register a normal account.
2. Verify the email using the Resend message.
3. Sign in.
4. Open **راه‌اندازی مدیر** in the account UI.
5. Enter `ADMIN_BOOTSTRAP_TOKEN` once. This succeeds only if no admin account exists.
6. Remove/rotate `ADMIN_BOOTSTRAP_TOKEN` in Cloudflare after the owner is created.

## Validation
GitHub Actions runs `npm install`, `npm run typecheck`, and `npm run build`.

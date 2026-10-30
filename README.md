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
- Public catalog of enabled products and Persian RTL account/admin interface.
- Tremendous API v2 adapter for Virtual Visa order creation/status lookup.
- One-click Cloudflare provisioning and main-branch automatic deployment workflow.

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
1. Install dependencies: `npm install`.
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Set a random `SESSION_SECRET` of at least 32 characters, a long random `ADMIN_BOOTSTRAP_TOKEN`, and valid Resend API key/from address.
4. Create the local D1 database and apply migrations: `npm run db:migrate:local`.
5. Start the Worker: `npx wrangler dev --port 8787`.
6. Start the frontend: `npm run dev` (Vite proxies `/api` to port 8787).

## One-time Cloudflare setup and automatic deploy
Follow [Cloudflare bootstrap and deployment](docs/cloudflare-bootstrap.md). Add the Cloudflare token/account ID and application secrets once to GitHub Actions, and add the public URL and verified Resend sender as Actions variables. The workflow then creates missing D1/R2/Queue resources, discovers the D1 ID, applies pending migrations, syncs Worker secrets, deploys, and checks API health on every push to `main`.

The Cloudflare API token needs Account D1 Edit, Workers Scripts Edit, Workers R2 Storage Edit, Queues Edit, and Account Settings Read. The Resend sender domain still needs to be verified manually. GitHub Actions never commits generated credentials or the generated Wrangler config.

## First administrator
1. Register a normal account.
2. Verify the email using the Resend message.
3. Sign in.
4. Open **راه‌اندازی مدیر** in the account UI.
5. Enter `ADMIN_BOOTSTRAP_TOKEN` once.
6. After successful owner creation, remove the bootstrap token from GitHub Actions and Cloudflare Worker secrets.

## Launch safety
Never commit credentials, wallet seed phrases, or private keys. Keep Tremendous in sandbox until provider approval, recipient eligibility enforcement, legal/compliance review, and end-to-end testing are complete. This infrastructure workflow does not enable live crypto processing or card issuance.

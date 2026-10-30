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
- Native Cloudflare Git integration deployment and Wrangler-managed resource provisioning.

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

## Cloudflare Git integration (no Cloudflare credentials in GitHub)
Connect this repository to the existing Worker from **Cloudflare Dashboard → Workers & Pages → your Worker → Settings → Builds → Connect**. Select this GitHub repository and the `main` branch.

Use these build settings:
- Build command: `npm run build`
- Deploy command: `npm run deploy`
- Root directory: repository root

Cloudflare Workers Builds authenticates deployments with its own account token. Do not add `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` to GitHub Actions. Wrangler provisions the supported D1, R2, and Queue resources declared in `wrangler.jsonc` during deployment. The deploy script then applies pending D1 migrations.

### One-time Worker secrets and variables
In **Worker → Settings → Variables and Secrets**, add runtime secrets:
- `SESSION_SECRET`: random value of at least 32 characters.
- `ADMIN_BOOTSTRAP_TOKEN`: long random one-time owner bootstrap token.
- `RESEND_API_KEY`: Resend API key.
- `TREMENDOUS_API_KEY`: optional; keep the provider in sandbox mode.

Add/update runtime variables:
- `APP_BASE_URL`: the exact HTTPS origin Cloudflare assigned to the Worker, or your custom domain.
- `RESEND_FROM_EMAIL`: sender address whose domain is verified in Resend.
- `APP_ENV`: `production`.

These are configured once in Cloudflare, not in GitHub. `keep_vars: true` prevents Wrangler deployments from overwriting dashboard-managed variables. Secrets are retained across deployments.

### First administrator
1. Register a normal account.
2. Verify the email using the Resend message.
3. Sign in.
4. Open **راه‌اندازی مدیر** in the account UI.
5. Enter `ADMIN_BOOTSTRAP_TOKEN` once.
6. After successful owner creation, delete `ADMIN_BOOTSTRAP_TOKEN` from Worker secrets. The owner bootstrap endpoint is one-time at database level.

## Launch safety
Never commit credentials, wallet seed phrases, or private keys. Keep Tremendous in sandbox until provider approval, recipient eligibility enforcement, legal/compliance review, and end-to-end testing are complete. This infrastructure workflow does not enable live crypto processing or card issuance.

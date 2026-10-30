# Changelog

## 0.3.0 - 2026-10-31
- Add customer registration, email verification, login, logout, and seven-day revocable sessions.
- Hash passwords with PBKDF2-HMAC-SHA-256 and store only HMAC-hashed opaque session and verification tokens.
- Add normalized-email rate limiting and same-origin checks for state-changing requests.
- Add one-time authenticated owner bootstrap protected by a Cloudflare secret.
- Add server-authorized admin product create, edit, list, and reversible disable operations.
- Add a public enabled-product catalog and Persian RTL account/admin interface.
- Add D1 migration for sessions, verification tokens, rate limits, and product pricing metadata.
- Add Resend email adapter and local Vite proxy to the Worker API.
- Document design, UX, and Cloudflare setup requirements.
- Keep customer order creation, payment processing, and card issuance disabled.

## 0.2.1 - 2026-10-31
- Extend GitHub Actions validation to run the production Vite build after TypeScript checks.
- Bump package version to 0.2.1.

## 0.2.0 - 2026-10-31
- Add a server-side Tremendous API v2 adapter for Virtual Visa order creation and status retrieval.
- Use stable external order IDs for provider-side idempotency.
- Add sandbox/live endpoint selection and configurable funding source/product IDs.
- Normalize provider order states and document recipient eligibility and name-field limitations.
- Keep provider issuance disconnected from public routes pending authenticated order and payment workflows.

## 0.1.1 - 2026-10-31
- Align `@cloudflare/workers-types` with the Workers types major version expected by current Wrangler 4 releases.
- Bump package version to 0.1.1.

## 0.1.0 - 2026-10-31
- Initialize Cloudflare Workers + Hono application foundation.
- Add React + Vite customer storefront shell.
- Add D1 schema for users, products, orders, USDT payment records, provider events, issuance attempts, and audit logs.
- Add chain configuration interfaces for TRON, Ethereum, and BNB Smart Chain.
- Add address-pool and card-provider interfaces.
- Add Cloudflare deployment configuration, local secret template, and CI typecheck workflow.
- Keep live crypto processing and live Tremendous issuance disabled pending implementation and compliance approval.

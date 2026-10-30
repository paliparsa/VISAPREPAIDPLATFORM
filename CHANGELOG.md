# Changelog

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

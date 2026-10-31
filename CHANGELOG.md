# Changelog

## 0.8.0 - 2026-10-31
- Generalize the signed Tremendous webhook receiver to persist and classify all event types, including unknown future events.
- Retain the verified raw event payload and source timestamp for audit and investigation.
- Add event processing attempt history, provider alerts, category analytics, event detail APIs, and alert acknowledgement.
- Add the Tremendous Intelligence admin module with all-time metrics, category filters, event search, raw payload inspection, alert triage, and built-in safe automation rules.
- Clarify the provider connection as webhook-only; no API calls, provider order creation, refunds, or automated issuance are enabled.
- Preserve manual payment verification and manual fulfillment safeguards.

## 0.7.0 - 2026-10-31
- Add a signed, idempotent Tremendous Gateway receiver endpoint in the main Worker.
- Persist provider webhook events, correlate order events to existing issuance attempts, and expose webhook activity in the admin console.
- Record provider-side order state separately; only verified canceled/failed order events can mark a linked order failed.
- Keep payment confirmation, crypto checkout, and live issuance gated/manual.


## 0.6.0 - 2026-10-31
- Add audited admin workflow to manually confirm externally verified payment references on existing orders.
- Add manual Tremendous fulfillment recording with provider order ID, optional HTTPS delivery URL, and internal note.
- Add D1 fields for manual payment evidence and manual issuance metadata, with duplicate provider-order protection.
- Keep customer checkout, customer order history, crypto monitoring, and automatic provider issuance disabled.

## 0.5.0 - 2026-10-31
- Add one-time, expiring password-reset tokens and password reset email flow.
- Allow customers to resend verification links for pending accounts.
- Activate pending accounts after successful email-based password recovery.
- Revoke existing sessions after a password change.
- Add Persian UI for forgot password, reset password, and resend verification.
- Return actionable email-delivery errors while keeping account-existence responses generic.

## 0.4.0 - 2026-10-31
- Replace credential-based GitHub Actions deployment with native Cloudflare Workers Git integration.
- Remove Cloudflare account ID/API token requirements from GitHub.
- Let Wrangler automatically provision supported D1, R2, and Queue resources from the Worker configuration.
- Deploy the Worker/assets first, then apply pending remote D1 migrations.
- Preserve dashboard-managed Worker variables and secrets across deployments.
- Keep GitHub Actions for validation only.
- Bump package version to 0.4.0.

## 0.3.0 - 2026-10-31
- Add customer registration, email verification, login, logout, and seven-day revocable sessions.
- Hash passwords with PBKDF2-HMAC-SHA-256 and store only HMAC-hashed opaque session and verification tokens.
- Add normalized-email rate limiting and same-origin checks for state-changing requests.
- Add one-time authenticated owner bootstrap protected by a Cloudflare secret.
- Add server-authorized admin product create, edit, list, and reversible disable operations with audit-log entries.
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

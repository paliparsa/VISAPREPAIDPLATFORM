# Visa Prepaid Platform

Cloudflare-native platform foundation for a Persian-language virtual prepaid card storefront serving customers who meet the card issuer/provider's country and eligibility requirements.

## Stack
- Cloudflare Workers + Hono API
- React + Vite frontend
- Cloudflare D1 database
- Cloudflare R2 private object storage
- Cloudflare Queues + Cron background jobs
- Planned USDT payment monitoring: TRON/TRC20, Ethereum/ERC20, BNB Smart Chain/BEP20
- Planned Resend transactional email
- Tremendous API v2 provider adapter (sandbox-first; live issuance remains gated)

## Provider integration status
A server-side Tremendous adapter is implemented for API v2 order creation and status retrieval. It supports the Prepaid Virtual Visa product, stable external IDs for idempotency, and sandbox/live endpoint selection.

See [provider integration setup](docs/provider-integration.md).

Important: the adapter's recipient name field does not guarantee a custom cardholder name. Recipient country and product eligibility must be checked against the provider's current rules. A Persian interface does not imply Iran-based recipients are supported.

## Mandatory launch gates
1. Obtain provider approval for the operating entity, business/reseller model, use case, and recipient countries.
2. Enforce eligibility based on actual recipient location and the current provider product/country catalog. Do not use nationality or interface language as a proxy.
3. Verify official USDT token contracts and chain identity before enabling deposits.
4. Generate deposit addresses outside this Worker. Never store seed phrases/private keys in GitHub, Worker variables, D1, or R2.
5. Complete legal/compliance review for AML/sanctions, custody, refunds, and crypto payment handling.
6. Implement authenticated customer/admin flows, payment confirmation, and an audited fulfillment state machine before connecting issuance to customer orders.

## Local
```bash
npm install
npm run dev
```

## D1
```bash
npm run db:migrate:local
```

## Cloudflare
Connect the GitHub repository to Workers Builds. Build: `npm run build`; deploy: `npm run deploy`.
Create D1, R2, Queue resources and bindings in Cloudflare, then set the D1 database ID in `wrangler.jsonc`. Never commit Cloudflare API tokens or provider secrets.

## Current status
The Tremendous provider adapter is implemented but is not yet connected to a public order/fulfillment route. Crypto payment monitoring, wallet address management, authentication, admin workflows, Resend delivery, reconciliation, and full tests remain outstanding. Live card issuance and live payment processing are not enabled by default.

# Visa Prepaid Platform

Cloudflare-native starter for a prepaid-card storefront for provider-approved, legally eligible customers.

## Stack
- Cloudflare Workers + Hono API
- React + Vite frontend
- Cloudflare D1 database
- Cloudflare R2 private object storage
- Cloudflare Queues + Cron background jobs
- Direct USDT monitoring: TRON/TRC20, Ethereum/ERC20, BNB Smart Chain/BEP20
- Resend transactional email
- Tremendous provider adapter (sandbox only until written approval)

## Mandatory launch gates
1. Obtain written Tremendous approval for the operating entity, reseller model, recipient countries, and actual cardholder-name behavior.
2. Do not serve recipients in prohibited/unsupported countries. Nationality alone does not establish eligibility.
3. Verify official USDT token contracts and chain identity before enabling deposits.
4. Generate deposit addresses outside this Worker. Never store seed phrases/private keys in GitHub, Worker variables, D1, or R2.
5. Complete legal/compliance review for AML/sanctions, custody, refunds, and crypto payment handling.

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

## Status
Foundation scaffold only. Auth, production blockchain indexers, address-pool import, Resend, Tremendous API integration, reconciliation, admin workflows and full tests remain to be implemented. Live card issuance and live payment processing are intentionally disabled.

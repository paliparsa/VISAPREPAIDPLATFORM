# Production readiness

## Provider and compliance
- [ ] Written Tremendous approval for the operating entity and reseller model.
- [ ] Recipient-country restrictions confirmed.
- [ ] Actual cardholder-name behavior confirmed; do not infer from recipient.name.
- [ ] Legal review completed for AML/sanctions, custody, refunds, and target markets.

## Blockchain
- [ ] Official USDT contract addresses independently verified per network.
- [ ] RPC/indexer selected for TRON, Ethereum, and BNB Smart Chain.
- [ ] Chain identity and confirmation thresholds verified.
- [ ] Bounded scanning, pagination, and reorg handling implemented.
- [ ] Address pool generated offline and securely imported.
- [ ] Sweep/custody process tested outside the Worker.
- [ ] Underpayment, overpayment, late payment, and duplicate transfers tested.

## Security and operations
- [ ] Password hashing, email verification, secure sessions implemented.
- [ ] Admin MFA and role-based authorization implemented.
- [ ] Cloudflare secrets configured; no credentials in Git.
- [ ] Logs redact payment payloads and delivery links.
- [ ] Backups, restore drill, rate limits, and abuse controls completed.
- [ ] Staging and production isolated.

## Go-live
- [ ] Sandbox end-to-end tests pass.
- [ ] Provider live credentials approved.
- [ ] Small-value pilot and incident runbooks completed.
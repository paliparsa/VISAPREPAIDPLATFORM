# Cloudflare one-time bootstrap and automatic deployment

After the initial GitHub configuration, every push merged into `main` runs validation, ensures Cloudflare resources exist, applies pending D1 migrations, updates Worker secrets, deploys the Worker + Vite assets, and checks `/api/health`.

## 1. Create a Cloudflare API token

Create a scoped API token in Cloudflare with these permissions for the target account:

- Account: D1 **Edit**
- Account: Workers Scripts **Edit**
- Account: Workers R2 Storage **Edit**
- Account: Queues **Edit**
- Account: Account Settings **Read**

Use the account ID shown in the Cloudflare dashboard. Do not use the Global API Key.

## 2. Add GitHub Actions secrets

In GitHub: **Settings → Secrets and variables → Actions → Secrets**, add:

| Secret | Required | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | Scoped Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `SESSION_SECRET` | Yes | Random secret, at least 32 characters |
| `ADMIN_BOOTSTRAP_TOKEN` | Yes | Long random one-time owner bootstrap token |
| `RESEND_API_KEY` | Yes | Resend API key |
| `TREMENDOUS_API_KEY` | Optional | Provider key; keep sandbox until approval |

Generate independent random values for `SESSION_SECRET` and `ADMIN_BOOTSTRAP_TOKEN`. Never commit these values or paste them into source files.

## 3. Add GitHub Actions variables

Under **Settings → Secrets and variables → Actions → Variables**, add:

- `APP_BASE_URL`: exact public HTTPS origin, e.g. `https://cards.example.com` (no trailing path).
- `RESEND_FROM_EMAIL`: verified sender, e.g. `Cards <cards@example.com>`.

The sender domain must already be verified in Resend. DNS/domain verification cannot be completed by GitHub Actions.

## 4. Run the first deployment

Merge the bootstrap PR into `main`, then open **Actions → Cloudflare Deploy → Run workflow** (or push a later commit to `main`).

The workflow idempotently creates only missing resources using the names already declared in `wrangler.jsonc`:

- D1: `visa-prepaid-db`
- R2: `visa-prepaid-private-files`
- Queue: `visa-prepaid-jobs`
- Dead-letter Queue: `visa-prepaid-jobs-dlq`

It writes the discovered D1 ID into a temporary generated Wrangler config in the runner; the real config and credentials are not rewritten or committed. D1 migrations are applied remotely before deployment. Re-running the workflow does not recreate existing resources or reapply already-recorded migrations.

## 5. Finish first-owner setup

1. Register through the website.
2. Verify the account using the Resend email.
3. Sign in and use **راه‌اندازی مدیر**.
4. Enter the `ADMIN_BOOTSTRAP_TOKEN` GitHub secret.
5. After the owner is successfully created, remove `ADMIN_BOOTSTRAP_TOKEN` from GitHub Actions secrets and Cloudflare Worker secrets. The owner bootstrap endpoint is one-time at database level.

## Automatic updates

Every merge/push to `main` triggers:

1. TypeScript validation and production build.
2. Idempotent resource provisioning.
3. Pending remote D1 migrations.
4. Worker secret synchronization.
5. Worker + static asset deployment.
6. Production health check.

Pull requests run the existing validation workflow only; they do not provision resources, apply production migrations, or deploy.

## Safety notes

- Provisioning requires a Cloudflare token with the listed account permissions. It cannot create or verify a Resend domain or obtain a Tremendous reseller approval.
- Keep `TREMENDOUS_MODE=sandbox` until provider approval and recipient eligibility controls are complete.
- This workflow does not activate crypto payment monitoring or public card issuance.
- Do not store wallet seeds/private keys in GitHub, D1, R2, or Worker secrets.
- D1 migrations run before deploy. Keep production migrations additive/backward-compatible; do not put destructive schema changes in an automatic deployment migration.
- If the first deploy fails, inspect the failed Actions step. Missing permissions, missing secrets/variables, or unverified sender-domain setup are reported there.

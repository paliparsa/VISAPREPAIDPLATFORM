# Cloudflare Git integration and automatic deployment

This project is deployed by Cloudflare Workers Builds directly from GitHub. GitHub Actions does not deploy to Cloudflare and does not need a Cloudflare API token or account ID.

## 1. Connect the repository
1. Open **Cloudflare Dashboard → Workers & Pages**.
2. Select the existing Worker named exactly `visa-prepaid-platform`, or create a Worker with that name.
3. Open **Settings → Builds → Connect**.
4. Connect the GitHub account and select `paliparsa/VISAPREPAIDPLATFORM`.
5. Select the `main` branch.

Cloudflare's Git integration uses an account token managed by Cloudflare Workers Builds. No `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or Cloudflare GitHub Actions secrets are required.

## 2. Build settings
Set the following values in **Worker → Settings → Builds**:

| Setting | Value |
| --- | --- |
| Root directory | repository root |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |

The deploy script runs `wrangler deploy` first, then applies pending D1 migrations remotely. This ordering is intentional: Wrangler provisions the D1 database and other declared resources during the first deployment, so the database exists before migrations are applied.

## 3. Automatic Cloudflare resources
The Wrangler configuration declares:
- D1 binding: `DB` (database name `visa-prepaid-db`)
- R2 binding: `PRIVATE_FILES` (Wrangler provisions the bucket)
- Queue producer binding: `JOBS` (queue `visa-prepaid-jobs`)
- Queue consumer and dead-letter queue: `visa-prepaid-jobs-dlq`

Wrangler's automatic resource provisioning creates supported resources on deploy when their IDs/names are omitted where supported. Cloudflare stores resource IDs in the account; for Git-based deployment they are visible in the dashboard and do not need to be committed to GitHub. Do not manually add account IDs or D1 UUIDs to the repository.

## 4. Configure runtime secrets and variables once
Open **Worker → Settings → Variables and Secrets** and add these as encrypted secrets:

| Secret | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Yes | Random secret, at least 32 characters |
| `ADMIN_BOOTSTRAP_TOKEN` | Yes, initially | Long random one-time owner bootstrap token |
| `RESEND_API_KEY` | Yes | Resend API key |
| `TREMENDOUS_API_KEY` | Optional | Provider key; keep sandbox until approval |

Add these plain-text variables:
- `APP_BASE_URL`: exact public HTTPS origin (Worker URL or custom domain).
- `APP_ENV`: `production`.
- `RESEND_FROM_EMAIL`: sender address whose domain is verified in Resend.

These values are configured directly on the Worker, not in GitHub. The Wrangler setting `keep_vars: true` preserves dashboard-managed variables during deploy. Worker secrets are retained by deployment and are never committed.

## 5. First deployment and owner setup
1. Save the Git integration settings. Cloudflare builds and deploys the `main` branch.
2. Check the build log. It should show Worker deployment followed by D1 migration application.
3. Open the deployed site and register a normal account.
4. Verify the account through the Resend email and sign in.
5. Use **راه‌اندازی مدیر** and enter `ADMIN_BOOTSTRAP_TOKEN`.
6. After the owner is successfully created, remove `ADMIN_BOOTSTRAP_TOKEN` from Worker secrets.

## Automatic updates
Every push or merge to the connected `main` branch triggers:
1. `npm run build` (TypeScript validation and Vite production build).
2. `wrangler deploy` (Worker + static assets and supported resource provisioning).
3. `wrangler d1 migrations apply visa-prepaid-db --remote`.
4. Cloudflare deployment status and logs in the Worker dashboard and GitHub commit checks.

GitHub Actions remains limited to validation. It does not create Cloudflare resources, mutate production data, or deploy.

## Safety notes
- Resend sender-domain verification is still a one-time external DNS/provider step.
- Keep `TREMENDOUS_MODE=sandbox` until provider approval and recipient eligibility controls are complete.
- This workflow does not activate crypto payment monitoring or public card issuance.
- Do not store wallet seeds/private keys in GitHub, D1, R2, or Worker secrets.
- Keep production migrations additive/backward-compatible; avoid destructive schema changes in automatic deploy migrations.

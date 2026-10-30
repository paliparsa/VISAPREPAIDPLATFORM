# Authentication and admin setup

## Required Worker secrets

Set the following in Cloudflare Worker settings (or with Wrangler secrets):

- `SESSION_SECRET`: random secret, at least 32 characters. Used as an HMAC key for opaque session and verification-token hashes.
- `ADMIN_BOOTSTRAP_TOKEN`: long random one-time owner bootstrap secret. Remove or rotate it after creating the owner.
- `RESEND_API_KEY`: Resend API key.
- `TREMENDOUS_API_KEY`: only when provider sandbox testing is approved.

## Required Worker variables

- `APP_BASE_URL`: exact public HTTPS origin, without a path, e.g. `https://cards.example.com`. CORS, origin checks, secure cookie policy, and email verification links depend on this value.
- `APP_ENV=production`.
- `RESEND_FROM_EMAIL`: verified sender address in Resend.
- `TREMENDOUS_MODE=sandbox` until live provider approval.

## Apply database migration

Run locally with `npm run db:migrate:local` or remotely with `npm run db:migrate:remote`. Migration `0002_auth_and_catalog.sql` creates sessions, email verification tokens, and auth rate-limit storage, then adds product sale pricing and display metadata.

## Bootstrap the first owner

1. Create an account through the Persian registration page.
2. Verify its email using the Resend link.
3. Sign in.
4. When no admin exists, the first verified account sees the owner setup panel.
5. Enter the exact `ADMIN_BOOTSTRAP_TOKEN` configured in Cloudflare.
6. The server promotes the currently signed-in account only if no admin exists yet.
7. Remove the bootstrap secret from Worker settings after success.

The bootstrap endpoint requires both an active session and the secret. Never put the bootstrap token in frontend source, GitHub, URL query strings, or logs.

## Security model

- Passwords use PBKDF2-HMAC-SHA-256 with 100,000 iterations and unique random salts.
- Session tokens are random, opaque, stored only as HMAC hashes, and delivered in HttpOnly SameSite=Lax cookies. HTTPS deployments use a `__Host-` cookie with Secure and Path=/.
- Logout revokes the session in D1.
- Auth mutations require an exact same-origin match and are rate-limited by normalized email.
- Admin product APIs authorize OWNER/ADMIN server-side on every request.
- Product disable is a reversible soft-disable.
- Email verification tokens are single-use, HMAC-hashed, and expire after 30 minutes.

Before production, add IP/device-aware abuse controls, automated security tests, session cleanup, password reset/recovery, resend-verification UX, and operational alerting. Do not treat this first auth slice as a complete security certification.

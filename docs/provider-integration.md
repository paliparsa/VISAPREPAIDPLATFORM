# Tremendous provider integration

The platform includes a server-side Tremendous API v2 adapter and an authenticated, read-only connection test.

## Configuration

The owner/admin console can store the Sandbox API key in D1 after encrypting it with AES-GCM. The encryption key itself must remain a Cloudflare Worker Secret named `ENCRYPTION_KEY` (Base64-encoded 32 random bytes). The API key is never returned to the browser or written to audit metadata.

- `TREMENDOUS_MODE`: keep `sandbox` until written provider approval and compliance review.
- `TREMENDOUS_API_KEY`: optional Cloudflare Secret; in Live mode it takes precedence over the encrypted Sandbox key.
- `TREMENDOUS_FUNDING_SOURCE_ID`: optional Cloudflare variable; the admin console can store a non-secret funding source ID.
- `TREMENDOUS_VISA_PRODUCT_ID`: optional; defaults to `V4QZ00F554D3` (Prepaid Virtual Visa).

Sandbox: `https://testflight.tremendous.com/api/v2`; production: `https://api.tremendous.com/api/v2`.

## Admin console

Open **اتصال Tremendous** after signing in as OWNER or ADMIN. Enter the Sandbox API key, funding source ID, and Visa product ID. The API key is encrypted at rest using AES-GCM. The **تست اتصال** action sends only `GET /funding_sources`; it does not create orders or spend funds. Select only a funding source whose status is active and whose `usage_permissions` includes `api_orders`.

To create an encryption secret, run `openssl rand -base64 32` locally and add its output as the Worker Secret `ENCRYPTION_KEY`. Do not paste this value into GitHub or the browser.

## Safety and eligibility

- Live order creation requires both `TREMENDOUS_MODE=live` and `ISSUANCE_MODE=LIVE_APPROVED`; the admin console does not expose a Live switch.
- Stable external order IDs are used for provider-side idempotency.
- The adapter does not expose an unauthenticated public HTTP endpoint.
- The API `recipient.name` is recipient metadata; it does **not** guarantee that the displayed cardholder name can be customized.
- Eligibility depends on the recipient's actual location and provider rules, not the language of the storefront.
- Tremendous production access documentation says prohibited businesses include crypto-related businesses. Do not connect this provider to a USDT-funded checkout or enable live issuance unless Tremendous has explicitly confirmed in writing that the exact operating entity and business model are permitted. See [Tremendous production API access](https://developers.tremendous.com/docs/production-api-access).

## API behavior

- `POST /orders` creates one Virtual Visa reward delivered by email.
- `GET /orders/{id}` retrieves order status.
- `GET /funding_sources` is used by the admin console connection test.

An authenticated fulfillment service must call the issuance adapter only after payment verification, recipient eligibility checks, and a committed idempotent issuance record. The public checkout and payment reconciliation workflow is not implemented yet.

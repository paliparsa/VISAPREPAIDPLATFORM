# Tremendous provider integration

The platform includes a server-side Tremendous API v2 adapter.

## Configuration

Set these as Cloudflare Worker secrets/variables (never commit credentials):

- `TREMENDOUS_API_KEY` — API key for the selected environment.
- `TREMENDOUS_MODE` — `sandbox` or `live`. Any other value disables issuance.
- `TREMENDOUS_FUNDING_SOURCE_ID` — active funding source with `api_orders` permission.
- `TREMENDOUS_VISA_PRODUCT_ID` — optional; defaults to `V4QZ00F554D3` (Prepaid Virtual Visa).

Sandbox: `https://testflight.tremendous.com/api/v2`; live: `https://www.tremendous.com/api/v2`.

## Safety behavior

- Uses the platform order's stable external ID as Tremendous `external_id` for idempotent order creation.
- Maps Tremendous `EXECUTED`, pending/open, `FAILED`, and `CANCELED` states to platform statuses.
- Does not expose the API key or raw provider response.
- Live mode is not enabled by default. Do not set it until the account, business model, card product, recipient-country coverage, and funding source are approved and tested.
- The API `recipient.name` is recipient metadata; it does **not** guarantee that the displayed cardholder name can be customized.
- Eligibility is based on the recipient's actual location and provider rules, not the language of the storefront.

## API behavior

- `POST /orders` creates one Virtual Visa reward delivered by email.
- `GET /orders/{id}` retrieves order status.

The adapter is intentionally not exposed as a public HTTP endpoint. An authenticated fulfillment service must call it only after payment verification, eligibility checks, and a committed idempotent issuance record.

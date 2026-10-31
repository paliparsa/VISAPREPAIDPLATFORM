# UX Contract

## Product context
- Audience: Persian-speaking customers and authorized operations staff.
- Primary jobs: create/access an account, browse enabled products, and let authorized operators inspect and configure the platform.
- Target markets: recipients accepted by the card provider, subject to actual residence and provider eligibility.
- Active locales: fa-IR (RTL), with LTR treatment for emails, identifiers, and monetary values.
- Accessibility target: WCAG 2.2 AA baseline.

## Business-context sources
| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Provider eligibility and issuance | docs/provider-integration.md | Provider integration contract | 2026-10-31 |
| Permission model | src/api/admin.ts and src/api/operations.ts | Implemented server authorization | 2026-10-31 |
| Account lifecycle | migrations/0001_initial.sql and migrations/0002_auth_and_catalog.sql | D1 schema | 2026-10-31 |
| Product lifecycle | src/api/admin.ts | Admin API contract | 2026-10-31 |
| Admin settings storage | src/lib/tremendous-config.ts and migrations/0004_admin_operations.sql | Encrypted settings contract | 2026-10-31 |

## Visual contract
- Project DESIGN.md: DESIGN.md
- Token ownership: runtime CSS custom properties in frontend/src/style.css are canonical.
- Theme: dark only.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | native labeled fields + shared CSS | this contract | auth / product / provider settings | keyboard + API validation |
| CRUD | /api/admin/products | this contract | create / edit / soft-disable | API + CI |
| Tables | AdminConsole semantic tables | this contract | paginated read-only operations tables | API paging + responsive |
| Feedback | App shared message banner | this contract | success / error | live region |
| Permissions | requireAdmin middleware | src/auth/security.ts | OWNER/ADMIN | 401/403 API tests pending |
| Secret storage | AES-GCM encrypted D1 setting | src/lib/tremendous-config.ts | Sandbox API key | encryption/decryption tests pending |

## Component behavior
- All forms use noValidate and application-owned validation.
- Password and API-key inputs are masked by default; paste remains enabled.
- Product create/edit returns to the catalog list and shows shared feedback.
- Product disable is reversible soft-disable.
- Provider API keys are encrypted at rest; raw keys never appear in GET responses, logs, or audit metadata.
- Provider connection test is read-only and uses GET /funding_sources.
- Orders, customers, provider settings, and audit activity are server-authorized for OWNER/ADMIN.
- Order and customer lists use server pagination (20 rows, max 50) and query filters.
- Payment configuration is informational; the UI must not imply that configured chain names mean monitoring or payment confirmation is operational.
- No manual payment confirmation, order status mutation, or live issuance action is exposed in the console.
- All privileged operations are enforced server-side.

## Flow ledger
| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery |
|---|---|---|---|---|---|
| Register / login | Auth form | Disabled submit | Account overview | Inline status | Preserve input |
| Bootstrap owner | One-time setup form | Disabled action | Admin console | Owner-created message | Explain one-time setup |
| Create/edit product | Product form | Disabled save | Product list | Shared success banner | Preserve form |
| Disable product | Product action | Request pending | Product list | Shared success banner | Product remains enabled on failure |
| Save provider settings | Provider form | Disabled save | Provider settings | Shared success banner | Preserve non-secret values; key remains masked |
| Test provider | Test connection | Disabled action | Provider results | Connected state only after 2xx | Explain auth/rate-limit/network error |
| Browse orders/customers | List filters/pagination | Loading indicator | Same list | Updated result set | Keep current filters |
| Inspect activity | Activity tab | Loading indicator | Activity list | Loaded records | Retry |

## Navigation and responsive behavior
- Single-page app state; title updates between public and authenticated views.
- RTL by default; email, provider identifiers, and amounts use LTR treatment.
- Tables scroll horizontally on narrow screens; forms stack to one column.
- Admin navigation is horizontally scrollable on narrow screens.

## Async and resilience
- Auth mutations are server-validated and rate-limited.
- Verification and password-reset email URLs use the origin of the public request, never a local development URL; transactional emails use the approved black-and-white layout, Yekan-first font stack, and concise Persian copy.
- Sessions are opaque, stored hashed in D1, HttpOnly, SameSite=Lax cookies, and expire after seven days.
- Financial/provider mutations are pessimistic; UI updates only after server confirmation.
- Provider connection test is read-only; a failed or timed-out request is not reported as connected.
- Order/customer views are read-only and server-paginated.
- No checkout, crypto payment verification, or automated card delivery is enabled.

## Validation
- Passwords are at least 12 characters and hashed with PBKDF2-HMAC-SHA-256.
- Product values are integer minor units in USD; sale price cannot be lower than face value.
- Provider key encryption uses AES-GCM with a 12-byte random IV and a Cloudflare-only 32-byte key.
- API keys and encryption keys are never returned to the client.

## Permission and privacy
- Owner bootstrap is available only to an authenticated active account and succeeds only while no admin exists.
- Admin APIs require OWNER or ADMIN on every request.
- SUPPORT and FINANCE roles do not receive operations-console access.
- Provider credentials are stored encrypted; API key values are write-only.

## Verification
- CI: npm install, npm run typecheck, npm run build.
- Runtime tests for provider credential encryption, admin role denial, pagination, and connection test remain required before production.
- Browser verification remains required before public launch.

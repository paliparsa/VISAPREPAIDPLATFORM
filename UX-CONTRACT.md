# UX Contract

## Product context
- Audience: Persian-speaking customers and authorized operations staff.
- Primary jobs: create and access an account; browse enabled prepaid card products; manage the product catalog.
- Target markets: recipients accepted by the card provider, subject to actual residence and provider eligibility.
- Active locales: fa-IR (RTL), with LTR treatment for emails, identifiers, and monetary values.
- Accessibility target: WCAG 2.2 AA baseline.

## Business-context sources
| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Provider eligibility and issuance | docs/provider-integration.md | Provider integration contract | 2026-10-31 |
| Permission model | src/api/admin.ts and src/auth/security.ts | Implemented server authorization | 2026-10-31 |
| Account lifecycle | migrations/0001_initial.sql and migrations/0002_auth_and_catalog.sql | D1 schema | 2026-10-31 |
| Product lifecycle | src/api/admin.ts | Admin API contract | 2026-10-31 |

## Visual contract
- Project DESIGN.md: DESIGN.md
- Token ownership: existing runtime CSS is canonical; DESIGN.md mirrors the current values.
- Runtime token source: frontend/src/style.css :root custom properties.
- Theme: dark only at this stage.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | native labeled form fields + shared CSS rules | this contract | login / registration / product edit | keyboard + API validation |
| CRUD | /api/admin/products | this contract | create / edit / soft-disable | API + CI |
| Toast/feedback | shared message banner in App | this contract | success / error | live region |
| Scrollbar | global html rules in style.css | DESIGN.md | standard | computed style |
| Permissions | server-side requireAdmin middleware | src/auth/security.ts | owner/admin | 401/403 API tests pending |

## Component behavior
- Forms use noValidate and application-owned validation.
- Password inputs are masked by default; paste and password managers remain enabled.
- Auth errors are generic for invalid credentials.
- Product create/edit returns to the catalog list and shows inline success/error feedback.
- Product disable is a reversible soft-disable; editing can re-enable it.
- All privileged API operations are enforced server-side; hiding admin UI is not authorization.

## Flow ledger
| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery |
|---|---|---|---|---|---|
| Register | Create account | Disabled submit | Login form | Email verification guidance | Preserve form fields |
| Verify email | Email link | Verify request | Login form | Verification status | Explain expired/invalid link |
| Login | Sign in | Disabled submit | Account overview | Signed-in state | Generic inline error |
| Logout | Header action | Disabled action | Public auth view | Signed-out message | Preserve session if request fails |
| Create product | Admin form | Disabled save | Catalog list | Created message | Preserve form |
| Edit product | Row action | Disabled save | Catalog list | Updated message | Preserve form |
| Disable product | Row action | Request pending | Catalog list | Disabled message | Product remains visible on failure |
| Bootstrap owner | Setup form | Disabled action | Admin catalog | Owner-created message | Explain one-time setup conditions |

## Navigation and responsive behavior
- Single-page app state; title updates between public and authenticated views.
- RTL by default; email and provider identifiers are LTR.
- Tables scroll horizontally on narrow screens; forms stack to one column.

## Async and resilience
- Auth mutations are server-validated and rate-limited by normalized email.
- Sessions are opaque, stored hashed in D1, HttpOnly, SameSite=Lax cookies, and expire after seven days.
- Logout revokes the current session in D1.
- Product updates are pessimistic; UI updates only after server success.
- No order, payment, or card-issuance action is exposed in this stage.

## Validation
- Passwords are at least 12 characters and hashed with PBKDF2-HMAC-SHA-256 (100,000 iterations).
- Email verification links expire after 30 minutes and are single-use.
- Product values are integer minor units in USD; sale price cannot be lower than face value.
- Product forms suppress browser-native validation and show app-owned messages.

## Permission and clipboard
- Owner bootstrap is available only to an authenticated, active account, requires the bootstrap secret, and succeeds only while no admin exists.
- Admin catalog APIs require OWNER or ADMIN on every request.
- SUPPORT and FINANCE roles do not receive catalog write access.

## Verification
- CI: npm install, npm run typecheck, npm run build.
- Runtime tests for registration, email verification, login/logout, session expiry, role denial, bootstrap race, and product CRUD are still required before production.
- Browser verification is pending; no live deployment has been performed.

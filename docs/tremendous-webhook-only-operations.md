# Tremendous Webhook-only Operations

## Connection model

The current Tremendous account has webhook delivery access only. The platform MUST treat Tremendous as a one-way event source. No API key is assumed, no outbound Tremendous API call is required, and the platform must not imply that it can create, cancel, refund, or query provider orders.

Tremendous sends signed events to the Gateway at `https://notify.roshava.app/webhook`. The Gateway validates the Tremendous signature using `TREMENDOUS_WEBHOOK_SECRET`, persists the exact raw request body in Durable Object SQLite, and forwards it to the main Worker using an internal HMAC signature.

The main Worker receiver is `POST /api/internal/webhooks/tremendous`. It verifies `GATEWAY_SHARED_SECRET`, validates the idempotency key against the payload UUID, and persists the verified raw payload in D1.

## Event handling

All verified event types are stored. Known event families are classified as ORDER, REWARD, FRAUD, FUNDING, PRODUCT, or UNKNOWN. Unknown future event types are retained without side effects.

Only order events with a matching manually recorded provider order ID update a local issuance attempt. An unmatched order event remains UNMATCHED until an administrator records the provider order ID against the corresponding internal order.

Risk-sensitive events create provider alerts. Alert acknowledgement is an internal administrative action only; it does not change the state of the resource at Tremendous.

## Safety boundaries

- Webhook receipt is not proof that a customer paid.
- `REWARDS.DELIVERY.SUCCEEDED` is not proof that a recipient redeemed or used a reward.
- Funding events are not a live balance endpoint.
- Product change events are not a full product catalog or price quote.
- The system never automatically issues, cancels, refunds, or modifies Tremendous orders.
- Payment confirmation and manual fulfillment remain separately audited admin actions.
- Raw payload and event details are visible only through authenticated admin routes.

## Admin module

The Visa admin console includes the Tremendous Intelligence module: all-time event metrics, event category distribution, searchable event history, verified raw payload inspection, processing attempt history, open alert triage and acknowledgement, and a read-only list of built-in safe event-to-alert rules.

The Gateway admin console exposes all-time delivery metrics, event-type distribution, server-side search, event detail, and retry for failed deliveries.

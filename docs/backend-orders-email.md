# Backend Order + Email Automation Setup

## Webhook endpoint

`POST /api/shop/webhook`

This endpoint now:
- verifies Stripe signature (`STRIPE_WEBHOOK_SECRET`)
- handles `checkout.session.completed`
- upserts `public.orders` by `stripe_checkout_session_id`
- replaces `public.order_items` snapshot rows for idempotent retries
- optionally sends confirmation email (best-effort, non-blocking)

## Required environment variables (order persistence)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Optional email automation variables

- `RESEND_API_KEY`
- `ORDER_CONFIRMATION_FROM_EMAIL`

Behavior:
- If optional email vars are present, webhook sends an order confirmation email for newly created orders.
- On webhook retries / existing orders, it skips email to reduce duplicates.
- Email failures are logged and do not block order persistence.

## Stripe webhook config

Set destination to:

- `https://<your-domain>/api/shop/webhook`

Subscribe to:

- `checkout.session.completed`

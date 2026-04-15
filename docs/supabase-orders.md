# Supabase Orders + Stripe Webhook Setup

## 1. Run migrations

```bash
supabase db push
```

This applies:
- `public.order_status` enum
- `public.orders`
- `public.order_items`
- indexes + `updated_at` trigger
- RLS enablement on `orders` and `order_items`

## 2. Set Edge Function secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=...
```

Required secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3. Deploy webhook function

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` is required because Stripe calls this endpoint directly.

## 4. Configure Stripe webhook endpoint

Point Stripe to:

```text
https://<PROJECT_REF>.functions.supabase.co/stripe-webhook
```

Subscribe to:
- `checkout.session.completed`

## 5. Test with Stripe CLI

```bash
stripe listen --forward-to https://<PROJECT_REF>.functions.supabase.co/stripe-webhook
stripe trigger checkout.session.completed
```

Expected result:
- upserted row in `public.orders` by `stripe_checkout_session_id`
- replace-and-insert snapshot rows in `public.order_items`
- retries remain idempotent via unique session id + item replacement

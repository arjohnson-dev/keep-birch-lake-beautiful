# Stripe Webhook Deployment Runbook

## Overview

This runbook walks through deploying the `stripe-webhook` Supabase Edge Function to automatically write orders to the database when Stripe checkout completes.

**Project Reference:** `llihmmwtuktnhpjphbbi`  
**Supabase URL:** `https://llihmmwtuktnhpjphbbi.supabase.co`

---

## Step 1: Gather Required Secrets

### 1a. Get Stripe Secret Key & Webhook Secret

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** (bottom left) > **API Keys**
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)
   - Save as: `STRIPE_SECRET_KEY`
4. Navigate to **Developers** > **Webhooks**
5. Click the endpoint URL or create one if needed (we'll set this in Step 4)
6. Copy the **Signing secret** (starts with `whsec_`)
   - Save as: `STRIPE_WEBHOOK_SECRET`

### 1b. Get Supabase URL & Service Role Key

1. Go to [Supabase Dashboard](https://app.supabase.com) and select "keep birch lake beautiful"
2. Navigate to **Settings** (bottom left) > **API**
3. Copy **Project URL** (e.g., `https://llihmmwtuktnhpjphbbi.supabase.co`)
   - Save as: `SUPABASE_URL`
4. Under **Project API Keys**, find the **Service Role** section
5. Copy the long key under "service_role"
   - Save as: `SUPABASE_SERVICE_ROLE_KEY`

### 1c. Optional: Email Automation Secrets

If you want Stripe checkout completion to send confirmation emails via Resend:

1. Go to [Resend Dashboard](https://resend.com)
2. Copy your **API Key**
   - Save as: `RESEND_API_KEY`
3. Set your confirmation email address
   - Save as: `ORDER_CONFIRMATION_FROM_EMAIL` (e.g., `orders@yourstore.com`)

---

## Step 2: Confirm Project Link

Verify the Supabase project is linked:

```bash
cd c:\Repos\keep-birch-lake-beautiful
supabase projects list
```

Look for "keep birch lake beautiful" with a bullet (●) next to it.

---

## Step 3: Set Secrets in Supabase

Run this command from the project root, replacing the placeholder values with your actual secrets:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY="sk_test_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  SUPABASE_URL="https://llihmmwtuktnhpjphbbi.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
```

**Optional – Email secrets:**

```bash
supabase secrets set \
  RESEND_API_KEY="re_..." \
  ORDER_CONFIRMATION_FROM_EMAIL="orders@your-store.com"
```

**Verify secrets were set:**

```bash
supabase secrets list
```

You should see all secrets listed (values hidden).

---

## Step 4: Deploy the Function

Deploy the `stripe-webhook` function with JWT verification disabled (required for Stripe origin):

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

**Expected output:**

```
Deploying function 'stripe-webhook'...
✓ Function deployed successfully at https://llihmmwtuktnhpjphbbi.functions.supabase.co/stripe-webhook
```

**Copy the function URL** – you'll need it for Stripe webhook configuration.

---

## Step 5: Configure Stripe Webhook Endpoint

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) > **Developers** > **Webhooks**
2. Click **+ Add endpoint**
3. Enter the function URL from Step 4:
   ```
   https://llihmmwtuktnhpjphbbi.functions.supabase.co/stripe-webhook
   ```
4. Select events: **checkout.session.completed**
5. Click **Add endpoint**
6. You'll see the **Signing secret** (starts with `whsec_`) displayed at the top
   - **If this is different from what you set in Step 3**, update secrets again:
     ```bash
     supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
     ```

---

## Step 6: Test the Deployment

### 6a. Manual Test with Stripe CLI

**Install Stripe CLI** (if not already installed):

```bash
# Windows (using Scoop, Chocolatey, or download from https://stripe.com/docs/stripe-cli)
scoop install stripe
```

**Forward Stripe events locally (optional, for testing):**

```bash
stripe listen --forward-to localhost:3001/stripe-webhook
```

**Trigger a test event:**

```bash
stripe trigger checkout.session.completed
```

### 6b. Test with Real Checkout

1. Go to your store's shop page (e.g., http://localhost:5173/shop)
2. Add items to cart
3. Complete a test checkout using Stripe test card: `4242 4242 4242 4242`
4. Verify order was created:
   ```bash
   # Via Supabase Dashboard: Tables > orders
   # Or via SQL:
   SELECT * FROM public.orders ORDER BY created_at DESC LIMIT 1;
   SELECT * FROM public.order_items WHERE order_id = '...' ORDER BY created_at;
   ```

### 6c. Verify Order Data

Check the following:

- ✓ Order row exists with `status = 'paid'`
- ✓ `stripe_checkout_session_id` is populated
- ✓ `customer_email` and `customer_name` are captured
- ✓ `total_amount` matches what was charged
- ✓ `order_items` rows exist for each product in the order
- ✓ Items have correct `garment`, `design`, `size`, `quantity`, `price`

### 6d. Test Idempotency

Replay the same webhook to verify no duplicates are created:

```bash
stripe trigger checkout.session.completed --repeat
```

**Expected behavior:**

- Same order ID in database (upserted, not duplicated)
- Fresh `order_items` rows (old ones deleted, new ones inserted)

---

## Step 7: Verify Webhook Signature Security

Test that invalid signatures are rejected:

```bash
curl -X POST https://llihmmwtuktnhpjphbbi.functions.supabase.co/stripe-webhook \
  -H "stripe-signature: invalid_signature" \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed"}'
```

**Expected:** `400` error response (signature validation failed before processing)

---

## Troubleshooting

### Function Deployment Fails

```bash
supabase functions deploy stripe-webhook --no-verify-jwt --debug
```

Check for:

- Missing imports or syntax errors
- Network connectivity to Supabase
- Project link status

### Webhook Events Not Triggering

- Verify Stripe endpoint URL is correct in Webhook settings
- Check Stripe **Event log** to see if events are being sent
- Verify signing secret matches between Stripe and Supabase secrets

### Order Not Created / Write Fails

- Check function logs:
  ```bash
  supabase functions logs stripe-webhook --tail
  ```
- Verify all 4 required secrets are set
- Check Supabase database permissions (RLS policies should allow service role writes)
- Confirm `orders` and `order_items` tables exist with correct schema

### Invalid Lookup Key Errors

- Verify your Stripe price `lookup_key` matches one of these patterns:
  - Apparel: `{garment}_{design}_{size}` e.g., `tshirt_lake_lg`
  - Print: `print_{design}` e.g., `print_birch`
  - Print alt: `{design}_print` e.g., `birch_print`

---

## Monitoring & Observability

### View Function Logs

```bash
supabase functions logs stripe-webhook --tail
```

Example success log:

```json
{
  "level": "info",
  "message": "Processed checkout.session.completed",
  "checkoutSessionId": "cs_test_b1...",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "itemCount": 2
}
```

Example error log:

```json
{
  "level": "error",
  "message": "Stripe webhook handling failed",
  "error": "Missing required environment variable: STRIPE_SECRET_KEY"
}
```

### Query Recent Orders

```sql
SELECT
  id,
  created_at,
  stripe_checkout_session_id,
  customer_email,
  total_amount,
  status
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;
```

### Query Order Items for Specific Order

```sql
SELECT
  id,
  lookup_key,
  product_name,
  design,
  size,
  quantity,
  unit_amount
FROM public.order_items
WHERE order_id = 'YOUR_ORDER_ID'
ORDER BY created_at;
```

---

## Rollback

If you need to roll back:

1. **Stop webhook processing immediately:**
   - Go to Stripe Dashboard > Webhooks > Disable or delete endpoint

2. **Redeploy previous function revision (if needed):**

   ```bash
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

3. **Data is safe:**
   - Migrations and schema remain in place
   - Existing orders remain intact in Supabase

---

## Summary

| Step | Command                                                    | Purpose                               |
| ---- | ---------------------------------------------------------- | ------------------------------------- |
| 1    | N/A                                                        | Gather secrets from Stripe & Supabase |
| 2    | `supabase projects list`                                   | Verify project link                   |
| 3    | `supabase secrets set ...`                                 | Configure runtime secrets             |
| 4    | `supabase functions deploy stripe-webhook --no-verify-jwt` | Deploy function                       |
| 5    | Stripe Dashboard                                           | Register webhook endpoint             |
| 6    | Test checkout or `stripe trigger`                          | Validate end-to-end flow              |

**Success indicator:** Order in `public.orders` with associated `order_items` after test checkout.

---

## Support

For more information on:

- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Stripe Webhooks:** https://stripe.com/docs/webhooks/setup
- **Database schema:** See `supabase/migrations/20260415183000_orders_and_order_items.sql`
- **Function code:** `supabase/functions/stripe-webhook/index.ts`

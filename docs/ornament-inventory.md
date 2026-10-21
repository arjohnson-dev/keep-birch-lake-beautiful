# Ornament inventory

The active Stripe price with lookup key `ornament` appears under Home Goods.
The shop uses `public/shop/ornament.jpg` and Stripe's product name, description,
and price. Its inventory starts at 25; the Stripe `in-stock` metadata flag is
not required for this inventory-managed item.

## Deployment

1. Apply `supabase/migrations/20261021123814_ornament_inventory.sql` before deploying the app.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the Vercel backend
   (in addition to its existing Stripe configuration). Never expose the service key to the frontend.
3. Deploy the app and the updated Supabase `stripe-webhook` Edge Function.
   Both webhook implementations now recognize the ornament lookup key.
4. Verify `/api/shop/catalog` returns `ornament` with `availableQuantity: 25`
   (less any existing paid ornament orders).

Use a separate Supabase database for Stripe test mode and live mode.

For local `npm run dev:api`, put the server-side Supabase settings in the
git-ignored `.env` file. Vercel's API workers in this setup do not receive these
settings from `.env.local` alone.

## Stock behavior

Checkout checks availability, creates a 30-minute card checkout, then atomically
reserves the quantity before returning its payment URL. Competing requests cannot
reserve more than the stock limit. Unavailable quantities return HTTP 409.

Every catalog load and ornament checkout reconciles outstanding reservations
with Stripe: paid checkouts become sold and expired checkouts release stock.
This works even if the order webhook is delayed or retried. Payment or inventory
API failures stop the request without releasing unverified holds.

Paid manual and existing orders also count against stock, without double counting
checkout reservations. Manual orders must be entered before starting additional
online sales; the manual order editor does not reserve stock. Direct Stripe
payment links bypass this shop's inventory enforcement.

When availability is zero, the existing SOLD OUT display disables purchases.
Stock held by active checkouts is temporarily unavailable too. Catalog responses
are not cached. Already-open pages refresh stock on their next catalog load;
checkout always enforces the current limit.

Refunds do not automatically restock sold reservations. Increase `stock_limit`
only when additional physical inventory is available.

Run helper tests with `node --test tests/shop-inventory.test.js`.


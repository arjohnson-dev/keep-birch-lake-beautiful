import {
  getBaseUrl,
  getStripeClient,
  mergeCheckoutItems,
  resolveCheckoutLineItems,
} from "./lib/stripeShop.js";

function getAllowedShippingCountries() {
  const raw = process.env.STRIPE_ALLOWED_SHIPPING_COUNTRIES;
  if (!raw || typeof raw !== "string") {
    return ["US"];
  }

  const parsed = raw
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter((country) => /^[A-Z]{2}$/.test(country));

  if (parsed.length === 0) {
    return ["US"];
  }

  return [...new Set(parsed)];
}

function parseRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return null;
}

function isDonationOnlyCheckout(items) {
  return items.every((item) => item.lookupKey === "donation");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseRequestBody(req);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: "Cart is empty or malformed." });
  }

  const merged = mergeCheckoutItems(body.items);
  if (merged.error) {
    return res.status(400).json({ error: merged.error });
  }

  try {
    const stripe = getStripeClient();
    const resolved = await resolveCheckoutLineItems(merged.items);

    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }

    const baseUrl = getBaseUrl(req);
    const clientReferenceId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const allowedShippingCountries = getAllowedShippingCountries();
    const donationOnlyCheckout = isDonationOnlyCheckout(merged.items);
    const cancelUrl = donationOnlyCheckout
      ? `${baseUrl}/`
      : `${baseUrl}/shop/cart?checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: resolved.lineItems,
      success_url: `${baseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      client_reference_id: clientReferenceId,
      customer_creation: "always",
      allow_promotion_codes: false,
      billing_address_collection: "required",
      shipping_address_collection: donationOnlyCheckout
        ? undefined
        : {
            allowed_countries: allowedShippingCountries,
          },
    });

    return res.status(200).json({
      url: session.url,
      id: session.id,
      clientReferenceId,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to start Stripe Checkout right now.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

import { getOrnamentAvailability, reserveOrnaments } from "./lib/inventory.js";
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

function getShippingCurrency() {
  const raw = process.env.STRIPE_SHIPPING_CURRENCY;
  return typeof raw === "string" && /^[a-z]{3}$/i.test(raw.trim())
    ? raw.trim().toLowerCase()
    : "usd";
}

function getShippingAmountCents() {
  const amount = Number(process.env.STRIPE_SHIPPING_AMOUNT_CENTS ?? 2000);
  if (!Number.isInteger(amount) || amount < 0) {
    return 2000;
  }

  return amount;
}

function getInlineShippingRate(
  displayName,
  amount,
  currency,
  fulfillmentMethod,
) {
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      fixed_amount: {
        amount,
        currency,
      },
      display_name: displayName,
      metadata: {
        fulfillment_method: fulfillmentMethod,
      },
    },
  };
}

export function getShippingOptions(items = []) {
  const physicalItems = items.filter((item) => item.lookupKey !== "donation");
  const ornamentOnly = physicalItems.length > 0 &&
    physicalItems.every((item) => item.lookupKey === "ornament");
  const currency = getShippingCurrency();
  const manualShippingLabel =
    process.env.STRIPE_SHIPPING_LABEL?.trim() || "Ship order";
  const manualShippingRateId = process.env.STRIPE_SHIPPING_RATE_ID?.trim();
  const localDropoffLabel =
    process.env.STRIPE_LOCAL_DROPOFF_LABEL?.trim() ||
    "Local drop-off (Birch Lake area only)";
  const localDropoffRateId = process.env.STRIPE_LOCAL_DROPOFF_RATE_ID?.trim();

  const manualShippingOption = ornamentOnly
    ? getInlineShippingRate(manualShippingLabel, 1000, currency, "manual_shipping")
    : manualShippingRateId
    ? { shipping_rate: manualShippingRateId }
    : getInlineShippingRate(
        manualShippingLabel,
        getShippingAmountCents(),
        currency,
        "manual_shipping",
      );

  const localDropoffOption = localDropoffRateId
    ? { shipping_rate: localDropoffRateId }
    : getInlineShippingRate(localDropoffLabel, 0, currency, "local_dropoff");

  return [manualShippingOption, localDropoffOption];
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

    const ornamentQuantity = merged.items.find((item) => item.lookupKey === "ornament")?.quantity ?? 0;
    if (ornamentQuantity) {
      const available = await getOrnamentAvailability(stripe);
      if (ornamentQuantity > available) {
        return res.status(409).json({ error: available === 0
          ? "Ornament is out of stock."
          : `Only ${available} ornaments are available. Please update your cart.` });
      }
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
      ...(ornamentQuantity ? {
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        payment_method_types: ["card"],
      } : {}),
      line_items: resolved.lineItems,
      success_url: `${baseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      client_reference_id: clientReferenceId,
      customer_creation: "always",
      phone_number_collection: {
        enabled: true,
      },
      allow_promotion_codes: false,
      billing_address_collection: "required",
      shipping_address_collection: donationOnlyCheckout
        ? undefined
        : {
            allowed_countries: allowedShippingCountries,
          },
      shipping_options: donationOnlyCheckout ? undefined : getShippingOptions(merged.items),
      custom_text: donationOnlyCheckout
        ? undefined
        : {
            shipping_address: {
              message:
                "IMPORTANT: Local drop-off is only available near Birch Lake (Porter Township, MI).",
            },
          },
    });

    if (ornamentQuantity) {
      // Never expose a payable URL until the database has atomically reserved stock.
      let reserved;
      try {
        reserved = await reserveOrnaments(session.id, ornamentQuantity);
      } catch (error) {
        await stripe.checkout.sessions.expire(session.id);
        throw error;
      }
      if (!reserved) {
        await stripe.checkout.sessions.expire(session.id);
        return res.status(409).json({ error: "There are not enough ornaments left for this order. Please update your cart." });
      }
    }

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

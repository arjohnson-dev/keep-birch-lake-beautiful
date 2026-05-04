import { getStripeClient } from "./lib/stripeShop.js";

function formatAddress(address) {
  if (!address) {
    return null;
  }

  return [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.postal_code, address.country].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

function getShippingAddress(session) {
  const shippingName =
    session.shipping_details?.name ??
    session.customer_details?.name ??
    null;
  const shippingAddress =
    formatAddress(session.shipping_details?.address) ??
    formatAddress(session.shipping?.address) ??
    formatAddress(session.customer_details?.address);

  if (!shippingName && !shippingAddress) {
    return null;
  }

  return [shippingName, shippingAddress].filter(Boolean).join("\n");
}

function formatSizeLabel(size) {
  if (!size) {
    return null;
  }

  const normalizedSize = String(size).toLowerCase();
  const sizeLabels = {
    s: "SMALL",
    m: "MEDIUM",
    l: "LARGE",
    xl: "XL",
    xxl: "XXL",
    xxxl: "XXXL",
  };

  return sizeLabels[normalizedSize] ?? String(size).toUpperCase();
}

function parseLookupKey(lookupKey) {
  if (!lookupKey || typeof lookupKey !== "string") {
    return null;
  }

  if (lookupKey === "donation") {
    return {
      category: "donation",
      size: null,
    };
  }

  if (lookupKey.startsWith("print_") || lookupKey.endsWith("_print")) {
    return {
      category: "print",
      size: null,
    };
  }

  const tokens = lookupKey.split("_");
  if (tokens.length < 3) {
    return null;
  }

  return {
    category: "apparel",
    size: tokens[tokens.length - 1] ?? null,
  };
}

function toSummaryItem(lineItem) {
  const price = lineItem.price;
  const lookupKey = typeof price?.lookup_key === "string" ? price.lookup_key : "";
  const parsed = parseLookupKey(lookupKey);

  return {
    id: lineItem.id,
    productName:
      typeof price?.product === "object" && price.product?.name
        ? price.product.name
        : lineItem.description ?? "Unknown product",
    quantity: lineItem.quantity ?? 0,
    lineTotal: lineItem.amount_total ?? 0,
    sizeLabel: parsed?.category === "apparel" ? formatSizeLabel(parsed.size) : null,
    category: parsed?.category ?? null,
  };
}

function toOrderSummary(session, lineItems) {
  return {
    id: session.id,
    customerName: session.customer_details?.name ?? "",
    customerEmail: session.customer_details?.email ?? "",
    placedAt: session.created ? new Date(session.created * 1000).toISOString() : null,
    currency: session.currency ?? "usd",
    subtotalAmount: session.amount_subtotal ?? 0,
    totalAmount: session.amount_total ?? 0,
    checkoutReference: session.id,
    paymentReference:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    shippingAddress: getShippingAddress(session),
    items: lineItems.data.map(toSummaryItem),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionId = typeof req.query?.session_id === "string" ? req.query.session_id.trim() : "";

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return res.status(400).json({ error: "Missing or invalid checkout session id." });
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Checkout session not found." });
    }

    if (session.status !== "complete") {
      return res.status(200).json({
        ready: false,
        pollAfterMs: 1500,
      });
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ["data.price", "data.price.product"],
    });

    return res.status(200).json({
      ready: true,
      order: toOrderSummary(session, lineItems),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load order summary.",
    });
  }
}

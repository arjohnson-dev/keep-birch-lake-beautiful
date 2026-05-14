import { createClient } from "@supabase/supabase-js";
import { getStripeClient } from "./lib/stripeShop.js";

const HOME_GOODS_PREFIX = "home_goods_towel_";
const TOWEL_PREFIX = "towel_";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function getSupabaseAdminClient() {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function readRawBody(req) {
  if (typeof req.body === "string") {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }

  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return "";
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseLookupKey(lookupKey) {
  if (!lookupKey || typeof lookupKey !== "string") {
    return null;
  }

  if (lookupKey === "donation") {
    return {
      category: "donation",
      garment: "donation",
      design: "donation",
      size: null,
    };
  }

  if (lookupKey.startsWith("print_")) {
    const design = lookupKey.slice("print_".length);
    if (!design) {
      return null;
    }

    return {
      category: "print",
      garment: "print",
      design,
      size: null,
    };
  }

  if (lookupKey.endsWith("_print")) {
    const design = lookupKey.slice(0, -"_print".length);
    if (!design) {
      return null;
    }

    return {
      category: "print",
      garment: "print",
      design,
      size: null,
    };
  }

  if (lookupKey.startsWith(HOME_GOODS_PREFIX)) {
    const design = lookupKey.slice(HOME_GOODS_PREFIX.length);
    if (!design) {
      return null;
    }

    return {
      category: "home_goods",
      garment: "towel",
      design,
      size: null,
    };
  }

  if (lookupKey.startsWith(TOWEL_PREFIX)) {
    const design = lookupKey.slice(TOWEL_PREFIX.length);
    if (!design) {
      return null;
    }

    return {
      category: "home_goods",
      garment: "towel",
      design,
      size: null,
    };
  }

  const tokens = lookupKey.split("_");
  if (tokens.length < 3) {
    return null;
  }

  const garment = tokens[0] ?? null;
  const size = tokens[tokens.length - 1] ?? null;
  const design = tokens.slice(1, -1).join("_") || null;

  if (!garment || !size || !design) {
    return null;
  }

  return {
    category: "apparel",
    garment,
    design,
    size,
  };
}

function toOrderItemRow(orderId, lineItem) {
  const price = lineItem.price;
  if (!price?.id) {
    throw new Error(`Missing price id in line item '${lineItem.description ?? "unknown"}'.`);
  }

  const lookupKey = price.lookup_key;
  if (!lookupKey) {
    throw new Error(`Price '${price.id}' is missing lookup_key.`);
  }

  const parsed = parseLookupKey(lookupKey);
  if (!parsed) {
    throw new Error(`Could not parse lookup key '${lookupKey}'.`);
  }

  const quantity = lineItem.quantity ?? 0;
  if (quantity <= 0) {
    throw new Error(`Invalid quantity ${quantity} for line item '${lookupKey}'.`);
  }

  const productName =
    typeof price.product === "object" && price.product?.name
      ? price.product.name
      : lineItem.description ?? "Unknown product";

  const unitAmount =
    price.unit_amount ??
    Math.floor((lineItem.amount_subtotal ?? lineItem.amount_total ?? 0) / quantity);

  return {
    order_id: orderId,
    lookup_key: lookupKey,
    stripe_price_id: price.id,
    product_name: productName,
    category: parsed.category,
    garment: parsed.garment,
    design: parsed.design,
    size: parsed.size,
    quantity,
    unit_amount: unitAmount,
    line_total: lineItem.amount_total ?? unitAmount * quantity,
  };
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((cents ?? 0) / 100);
}

function getShippingRate(session) {
  const shippingRate = session.shipping_cost?.shipping_rate;
  return shippingRate && typeof shippingRate === "object" ? shippingRate : null;
}

function isManualShippingSession(session) {
  const shippingRate = getShippingRate(session);
  if (shippingRate?.metadata?.fulfillment_method === "manual_shipping") {
    return true;
  }

  return /^ship\b/i.test(shippingRate?.display_name ?? "");
}

async function sendOrderConfirmationEmail({ customerEmail, customerName, order, orderItems }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ORDER_CONFIRMATION_FROM_EMAIL;

  if (!resendApiKey || !fromEmail || !customerEmail) {
    return { sent: false, reason: "missing_email_configuration" };
  }

  const subject = `Order confirmation (${order.stripe_checkout_session_id})`;
  const lineItemsHtml = orderItems
    .map((item) => {
      const variant = [item.garment, item.design, item.size].filter(Boolean).join(" / ");
      return `<li>${item.product_name} (${variant}) x ${item.quantity} - ${formatMoney(item.line_total, order.currency)}</li>`;
    })
    .join("");
  const shippingNoteHtml = isManualShippingSession(order.raw_checkout_session)
    ? "<p>We will contact you within the next 24 hours to confirm your shipping method.</p>"
    : "";

  const html = `
    <h2>Thanks for your order${customerName ? `, ${customerName}` : ""}!</h2>
    <p>Order reference: <strong>${order.stripe_checkout_session_id}</strong></p>
    <p>Total: <strong>${formatMoney(order.total_amount, order.currency)}</strong></p>
    ${shippingNoteHtml}
    <h3>Items</h3>
    <ul>${lineItemsHtml}</ul>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: customerEmail,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend API error: ${details}`);
  }

  return { sent: true };
}

async function persistOrderRecord({ supabase, session, lineItems }) {
  const orderPayload = {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    stripe_customer_id:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null,
    customer_email: session.customer_details?.email ?? null,
    customer_name: session.customer_details?.name ?? null,
    currency: session.currency,
    subtotal_amount: session.amount_subtotal ?? 0,
    total_amount: session.amount_total ?? 0,
    status: "paid",
    raw_checkout_session: session,
  };

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  const { data: upsertedOrder, error: upsertError } = await supabase
    .from("orders")
    .upsert(orderPayload, { onConflict: "stripe_checkout_session_id" })
    .select("id")
    .single();

  if (upsertError || !upsertedOrder?.id) {
    throw new Error(`Order upsert failed: ${upsertError?.message ?? "unknown error"}`);
  }

  const orderId = upsertedOrder.id;

  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  if (deleteError) {
    throw new Error(`Order item delete failed: ${deleteError.message}`);
  }

  const orderItems = lineItems.data.map((lineItem) => toOrderItemRow(orderId, lineItem));

  if (orderItems.length > 0) {
    const { error: insertError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (insertError) {
      throw new Error(`Order item insert failed: ${insertError.message}`);
    }
  }

  return {
    order: {
      ...orderPayload,
      id: orderId,
    },
    orderItems,
    wasExisting: Boolean(existingOrder?.id),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];

    if (!signature || typeof signature !== "string") {
      return res.status(400).send("Missing Stripe signature header.");
    }

    if (!webhookSecret) {
      return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET.");
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true, ignored: event.type });
    }

    const eventSession = event.data.object;
    const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
      expand: ["shipping_cost.shipping_rate"],
    });

    if (!session.currency) {
      throw new Error(`Checkout session '${session.id}' is missing currency.`);
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ["data.price", "data.price.product"],
    });

    const supabase = getSupabaseAdminClient();
    const persisted = await persistOrderRecord({ supabase, session, lineItems });

    try {
      if (!persisted.wasExisting) {
        await sendOrderConfirmationEmail({
          customerEmail: session.customer_details?.email ?? null,
          customerName: session.customer_details?.name ?? null,
          order: persisted.order,
          orderItems: persisted.orderItems,
        });
      }
    } catch (emailError) {
      console.error(
        `[order.email_failed] session=${session.id} error=${emailError instanceof Error ? emailError.message : "unknown"}`,
      );
    }

    console.log(
      `[order.persisted] session=${session.id} order=${persisted.order.id} items=${persisted.orderItems.length} existing=${persisted.wasExisting}`,
    );

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`[webhook.error] ${error instanceof Error ? error.message : "Unknown error"}`);
    return res.status(400).send(`Webhook error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

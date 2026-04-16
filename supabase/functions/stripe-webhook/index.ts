import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.2.0";

type OrderItemInsert = {
  order_id: string;
  lookup_key: string;
  stripe_price_id: string;
  product_name: string;
  category: string;
  garment: string;
  design: string;
  size: string | null;
  quantity: number;
  unit_amount: number;
  line_total: number;
};

const corsHeaders = {
  "Content-Type": "application/json",
};

const REQUIRED_ENV_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SB_URL",
  "SB_SERVICE_KEY",
] as const;

function requireEnv(name: (typeof REQUIRED_ENV_VARS)[number]): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseLookupKey(lookupKey: string) {
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

  const tokens = lookupKey.split("_");
  if (tokens.length < 2) {
    return {
      category: "apparel",
      garment: "unknown",
      design: lookupKey,
      size: null,
    };
  }

  const garment = tokens[0] ?? "";
  const size = tokens[tokens.length - 1] ?? "";
  const design = tokens.slice(1, -1).join("_");

  if (!garment || !design) {
    return {
      category: "apparel",
      garment: garment || "unknown",
      design: lookupKey,
      size: null,
    };
  }

  if (!ALLOWED_GARMENTS.has(garment) || !ALLOWED_SIZES.has(size)) {
    return {
      category: "apparel",
      garment,
      design,
      size: ALLOWED_SIZES.has(size) ? size : null,
    };
  }

  return {
    category: "apparel",
    garment,
    design,
    size,
  };
}

function mapLineItem(item: Stripe.LineItem, orderId: string): OrderItemInsert | null {
  const price = item.price;
  const quantity = item.quantity ?? 0;

  if (!price || !price.id) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Skipping line item without price id",
        orderId,
        description: item.description ?? "unknown",
      }),
    );
    return null;
  }

  const lookupKey = price.lookup_key ?? `price_${price.id}`;

  const parsed = parseLookupKey(lookupKey);

  const product = price.product;
  const productName =
    typeof product === "object" && product && "name" in product && product.name
      ? product.name
      : (item.description ?? "Unknown product");

  const unitAmount =
    price.unit_amount ??
    (quantity > 0 ? Math.floor((item.amount_subtotal ?? 0) / quantity) : 0);
  const safeQuantity = Math.max(1, quantity);
  const safeUnitAmount = Math.max(0, unitAmount);
  const safeLineTotal = Math.max(
    0,
    item.amount_total ?? safeUnitAmount * safeQuantity,
  );

  return {
    order_id: orderId,
    lookup_key: lookupKey,
    stripe_price_id: price.id,
    product_name: productName,
    category: parsed.category,
    garment: parsed.garment,
    design: parsed.design,
    size: parsed.size,
    quantity: safeQuantity,
    unit_amount: safeUnitAmount,
    line_total: safeLineTotal,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = requireEnv("SB_URL");
    const supabaseServiceRoleKey = requireEnv("SB_SERVICE_KEY");

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia",
    });
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const rawBody = await req.text();
    const cryptoProvider = Stripe.createSubtleCryptoProvider();

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSecret,
      undefined,
      cryptoProvider,
    );

    if (event.type !== "checkout.session.completed") {
      return new Response(
        JSON.stringify({ received: true, ignored: event.type }),
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ["data.price", "data.price.product"],
    });

    if (!session.currency) {
      throw new Error(`Checkout session ${session.id} is missing currency.`);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const orderPayload = {
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      stripe_customer_id:
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null),
      customer_email: session.customer_details?.email ?? null,
      customer_name: session.customer_details?.name ?? null,
      currency: session.currency,
      subtotal_amount: session.amount_subtotal ?? 0,
      total_amount: session.amount_total ?? 0,
      status: "paid",
      raw_checkout_session: session,
    };

    const { data: upsertedOrder, error: orderError } = await supabase
      .from("orders")
      .upsert(orderPayload, { onConflict: "stripe_checkout_session_id" })
      .select("id")
      .single();

    if (orderError || !upsertedOrder?.id) {
      throw new Error(
        `Failed to upsert order: ${orderError?.message ?? "unknown error"}`,
      );
    }

    const orderId = upsertedOrder.id;

    const { error: deleteItemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (deleteItemsError) {
      throw new Error(
        `Failed to clear existing order items: ${deleteItemsError.message}`,
      );
    }

    const mappedItems = lineItems.data
      .map((item) => mapLineItem(item, orderId))
      .filter((item): item is OrderItemInsert => item !== null);

    let insertedItemCount = 0;
    const itemInsertFailures: string[] = [];

    for (const mappedItem of mappedItems) {
      const { error: insertItemError } = await supabase
        .from("order_items")
        .insert(mappedItem);

      if (insertItemError) {
        itemInsertFailures.push(
          `${mappedItem.lookup_key}: ${insertItemError.message}`,
        );
        continue;
      }

      insertedItemCount += 1;
    }

    if (mappedItems.length > 0 && insertedItemCount === 0) {
      throw new Error(
        `Failed to insert order items. Errors: ${itemInsertFailures.join(" | ")}`,
      );
    }

    if (itemInsertFailures.length > 0) {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Some order items could not be inserted",
          orderId,
          failures: itemInsertFailures,
        }),
      );
    }

    console.log(
      JSON.stringify({
        level: "info",
        message: "Processed checkout.session.completed",
        checkoutSessionId: session.id,
        orderId,
        itemCount: insertedItemCount,
        mappedItemCount: mappedItems.length,
      }),
    );

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Stripe webhook handling failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    return new Response(JSON.stringify({ error: "Webhook handling failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

import Stripe from "stripe";

const ALLOWED_GARMENTS = new Set(["tshirt", "crewneck", "hooded", "print"]);
const ALLOWED_SIZES = new Set(["s", "m", "l", "xl", "xxl", "xxxl"]);

let stripeClient;

function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }

  stripeClient = new Stripe(apiKey, { apiVersion: "2025-02-24.acacia" });
  return stripeClient;
}

function chunk(items, size) {
  const batches = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function parseLookupKey(lookupKey) {
  if (lookupKey.startsWith("print_")) {
    const design = lookupKey.slice("print_".length);
    if (!design) {
      return null;
    }

    return {
      category: "print",
      garment: "print",
      design,
      size: undefined,
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
      size: undefined,
    };
  }

  const tokens = lookupKey.split("_");
  if (tokens.length < 3) {
    return null;
  }

  const garment = tokens[0];
  const size = tokens[tokens.length - 1];
  const design = tokens.slice(1, -1).join("_");

  if (!design || !ALLOWED_GARMENTS.has(garment) || !ALLOWED_SIZES.has(size)) {
    return null;
  }

  return {
    category: "apparel",
    garment,
    design,
    size,
  };
}

function normalizePrice(price) {
  if (!price || typeof price.lookup_key !== "string" || !price.active) {
    return null;
  }

  const product = price.product;
  if (!product || typeof product !== "object" || !product.active) {
    return null;
  }

  const parsed = parseLookupKey(price.lookup_key);
  if (!parsed) {
    return null;
  }

  if (typeof price.unit_amount !== "number") {
    return null;
  }

  return {
    productId: product.id,
    priceId: price.id,
    lookupKey: price.lookup_key,
    name: product.name,
    category: parsed.category,
    garment: parsed.garment,
    design: parsed.design,
    size: parsed.size,
    amount: price.unit_amount,
    currency: price.currency,
    active: true,
    imageUrl: null,
  };
}

function sortCatalogItems(items) {
  const categoryRank = { apparel: 0, print: 1 };

  return [...items].sort((left, right) => {
    const categoryDelta = categoryRank[left.category] - categoryRank[right.category];
    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    const designDelta = left.design.localeCompare(right.design);
    if (designDelta !== 0) {
      return designDelta;
    }

    const garmentDelta = left.garment.localeCompare(right.garment);
    if (garmentDelta !== 0) {
      return garmentDelta;
    }

    return (left.size ?? "").localeCompare(right.size ?? "");
  });
}

async function listNormalizedCatalog() {
  const stripe = getStripeClient();
  const items = [];

  for await (const price of stripe.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 100,
  })) {
    const normalized = normalizePrice(price);
    if (normalized) {
      items.push(normalized);
    }
  }

  return sortCatalogItems(items);
}

function mergeCheckoutItems(rawItems) {
  const merged = new Map();

  for (const item of rawItems) {
    const lookupKey = typeof item.lookupKey === "string" ? item.lookupKey.trim() : "";
    const quantity = Number(item.quantity);

    if (!lookupKey || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { error: "Invalid cart payload. Quantities must be whole numbers between 1 and 99." };
    }

    merged.set(lookupKey, (merged.get(lookupKey) ?? 0) + quantity);
  }

  return {
    items: [...merged.entries()].map(([lookupKey, quantity]) => ({ lookupKey, quantity })),
  };
}

async function resolveCheckoutLineItems(mergedItems) {
  const stripe = getStripeClient();
  const lookupKeys = mergedItems.map((item) => item.lookupKey);
  const byLookupKey = new Map();

  for (const keyBatch of chunk(lookupKeys, 10)) {
    const response = await stripe.prices.list({
      active: true,
      lookup_keys: keyBatch,
      limit: 100,
    });

    for (const price of response.data) {
      if (!price.lookup_key) {
        continue;
      }

      const list = byLookupKey.get(price.lookup_key) ?? [];
      list.push(price);
      byLookupKey.set(price.lookup_key, list);
    }
  }

  const lineItems = [];

  for (const item of mergedItems) {
    const matching = byLookupKey.get(item.lookupKey) ?? [];

    if (matching.length !== 1) {
      return {
        error: `Could not resolve an active price for lookup key "${item.lookupKey}".`,
      };
    }

    lineItems.push({
      price: matching[0].id,
      quantity: item.quantity,
    });
  }

  return { lineItems };
}

function getBaseUrl(req) {
  const explicitBaseUrl = process.env.PUBLIC_SITE_URL?.trim();
  if (explicitBaseUrl) {
    try {
      const parsed = new URL(explicitBaseUrl);
      const hostname = parsed.hostname.toLowerCase();
      const isLoopbackHost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";

      // Ignore accidental localhost config in Vercel production/preview.
      if (!isLoopbackHost || !process.env.VERCEL) {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // Fall back to host detection below if PUBLIC_SITE_URL is malformed.
    }
  }

  const forwardedHost = req.headers["x-forwarded-host"];
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProto === "string" ? forwardedProto : "https";
  const host =
    (typeof forwardedHost === "string" && forwardedHost) ||
    process.env.VERCEL_URL ||
    req.headers.host;

  if (!host || typeof host !== "string") {
    throw new Error("Unable to determine site host for checkout redirects.");
  }

  return `${protocol}://${host}`;
}

function toMoney(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export {
  getStripeClient,
  listNormalizedCatalog,
  mergeCheckoutItems,
  resolveCheckoutLineItems,
  getBaseUrl,
  toMoney,
};

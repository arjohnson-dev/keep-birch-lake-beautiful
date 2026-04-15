import { requestJson } from "./api.js";

async function createCheckoutSession(items) {
  const payload = await requestJson("/api/shop/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: items.map((item) => ({
        lookupKey: item.lookupKey,
        quantity: item.quantity,
      })),
    }),
  });

  if (!payload || typeof payload.url !== "string") {
    throw new Error("Could not create checkout session.");
  }

  return payload;
}

async function redirectToCheckout(items) {
  const payload = await createCheckoutSession(items);
  window.location.assign(payload.url);
}

export { createCheckoutSession, redirectToCheckout };

import { requestJson } from "./api.js";

// Inventory must be refreshed on every catalog load, including after checkout.
async function getSessionCatalog() {
  const payload = await requestJson("/api/shop/catalog", { cache: "no-store" });
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error("Unable to load the catalog.");
  }
  return payload;
}

function clearSessionCatalogCache() {
  // Kept for callers; catalog responses are no longer cached in session storage.
}

export { clearSessionCatalogCache, getSessionCatalog };

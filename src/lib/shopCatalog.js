import { requestJson } from "./api.js";

const CATALOG_CACHE_KEY = "kblb:shop-catalog:v1";

function readCatalogCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCatalogCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures (private mode, quota, etc.)
  }
}

async function getSessionCatalog() {
  const cached = readCatalogCache();
  if (cached) {
    return cached;
  }

  const payload = await requestJson("/api/shop/catalog");
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error("Unable to load the catalog.");
  }

  writeCatalogCache(payload);
  return payload;
}

function clearSessionCatalogCache() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(CATALOG_CACHE_KEY);
  } catch {
    // ignore
  }
}

export { clearSessionCatalogCache, getSessionCatalog };

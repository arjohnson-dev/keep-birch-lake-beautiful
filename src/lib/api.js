const HTML_LIKE_RESPONSE_PATTERN = /<!doctype html|<html[\s>]/i;

async function parseApiJson(response) {
  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!raw.trim()) {
    return null;
  }

  const isLikelyJson =
    contentType.includes("application/json") ||
    raw.trim().startsWith("{") ||
    raw.trim().startsWith("[");

  if (isLikelyJson) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("The API returned invalid JSON.");
    }
  }

  if (HTML_LIKE_RESPONSE_PATTERN.test(raw)) {
    throw new Error(
      "API routes returned HTML instead of JSON. In local dev run `npm run dev` and `npm run dev:api` together.",
    );
  }

  throw new Error("The API returned an unexpected response format.");
}

async function requestJson(input, init) {
  const response = await fetch(input, init);
  const payload = await parseApiJson(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

export { requestJson };

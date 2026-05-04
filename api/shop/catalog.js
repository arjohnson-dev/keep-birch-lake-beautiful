import { listNormalizedCatalog } from "./lib/stripeShop.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const items = await listNormalizedCatalog();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).json({ items });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load catalog from Stripe.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

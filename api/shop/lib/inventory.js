import { createClient } from "@supabase/supabase-js";

export const ORNAMENT_LOOKUP_KEY = "ornament";

function getInventoryClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase inventory configuration.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Stripe is the authority for releasing holds. Never release stock on a local
// timer: payment could have completed while its webhook is still in transit.
export async function getOrnamentAvailability(stripe, db = getInventoryClient()) {
  const { data: holds, error } = await db.from("shop_inventory_reservations")
    .select("session_id").eq("lookup_key", ORNAMENT_LOOKUP_KEY).eq("status", "held");
  if (error) throw error;
  await Promise.all(holds.map(async ({ session_id: sessionId }) => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const status = session.payment_status === "paid" || session.payment_status === "no_payment_required"
      ? "sold" : session.status === "expired" ? "released" : "held";
    if (status === "held") return;
    const { error: updateError } = await db.from("shop_inventory_reservations")
      .update({ status }).eq("session_id", sessionId).eq("status", "held");
    if (updateError) throw updateError;
  }));
  const { data, error: stockError } = await db.rpc("shop_inventory_available", {
    item_lookup_key: ORNAMENT_LOOKUP_KEY,
  });
  if (stockError) throw stockError;
  if (!Number.isInteger(data) || data < 0) throw new Error("Invalid ornament inventory.");
  return data;
}

export async function reserveOrnaments(sessionId, quantity, db = getInventoryClient()) {
  const { data, error } = await db.rpc("reserve_shop_inventory", {
    item_lookup_key: ORNAMENT_LOOKUP_KEY,
    checkout_session_id: sessionId,
    requested_quantity: quantity,
  });
  if (error) throw error;
  return data;
}

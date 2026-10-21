import { test } from "node:test";
import assert from "node:assert/strict";
import { getOrnamentAvailability, reserveOrnaments } from "../api/shop/lib/inventory.js";

function database(holds, available = 25) {
  const updates = [];
  const db = {
    updates,
    from() {
      let update;
      const query = {
        select() { return query; },
        update(value) { update = value; return query; },
        eq(field, value) {
          if (field === "session_id") updates.push({ sessionId: value, ...update });
          return query;
        },
        then(resolve) { resolve({ data: holds, error: null }); },
      };
      return query;
    },
    async rpc() { return { data: available, error: null }; },
  };
  return db;
}

test("only confirmed Stripe expiration releases a hold; paid sessions remain sold", async () => {
  const sessions = {
    paid: { payment_status: "paid", status: "complete" },
    free: { payment_status: "no_payment_required", status: "complete" },
    expired: { payment_status: "unpaid", status: "expired" },
    open: { payment_status: "unpaid", status: "open" },
    pending: { payment_status: "unpaid", status: "complete" },
  };
  const db = database(Object.keys(sessions).map((session_id) => ({ session_id })), 3);
  const stripe = { checkout: { sessions: { retrieve: async (id) => sessions[id] } } };
  assert.equal(await getOrnamentAvailability(stripe, db), 3);
  assert.deepEqual(db.updates, [
    { sessionId: "paid", status: "sold" },
    { sessionId: "free", status: "sold" },
    { sessionId: "expired", status: "released" },
  ]);
});

test("inventory errors fail closed", async () => {
  const stripe = { checkout: { sessions: { retrieve: async () => { throw new Error("Stripe unavailable"); } } } };
  await assert.rejects(getOrnamentAvailability(stripe, database([{ session_id: "open" }])), /Stripe unavailable/);
  await assert.rejects(getOrnamentAvailability(stripe, database([], null)), /Invalid ornament inventory/);
});

test("reservation uses merged quantity and propagates database failures", async () => {
  const db = { rpc: async (name, args) => {
    assert.equal(name, "reserve_shop_inventory");
    assert.deepEqual(args, { item_lookup_key: "ornament", checkout_session_id: "cs_123", requested_quantity: 25 });
    return { data: false, error: null };
  } };
  assert.equal(await reserveOrnaments("cs_123", 25, db), false);
  await assert.rejects(reserveOrnaments("cs_123", 1, {
    rpc: async () => ({ error: new Error("Database unavailable") }),
  }), /Database unavailable/);
});


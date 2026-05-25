import { useEffect, useMemo, useState } from "react";
import { getSessionCatalog } from "../lib/shopCatalog.js";
import { formatMoney, humanizeToken } from "../lib/shopProducts.js";
import { handleAppLinkClick, navigateTo } from "../lib/navigation.js";
import { supabase } from "../utils/supabase.ts";
import "./OwnerOrdersView.css";

const DISCOUNT_MODES = {
  percent: "percent",
  paidCash: "paid_cash",
};
const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial_payment", label: "Partial payment" },
  { value: "paid", label: "Paid" },
];
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDollarInputValue(cents) {
  return (cents / 100).toFixed(2);
}

function parseDollarAmount(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed * 100));
}

function trimToNull(value) {
  const trimmed = value.trim();
  return trimmed || null;
}

function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatCatalogItemLabel(item) {
  const parts = [
    item.name,
    item.category === "apparel" && item.size ? item.size.toUpperCase() : null,
    item.category !== "donation" ? humanizeToken(item.design) : null,
    item.inStock ? null : "Out of stock",
  ].filter(Boolean);

  return `${parts.join(" - ")} (${formatMoney(item.amount, item.currency)})`;
}

function buildOrderItemRow(orderId, item, quantity) {
  return {
    order_id: orderId,
    lookup_key: item.lookupKey,
    stripe_price_id: null,
    product_name: item.name,
    category: item.category,
    garment: item.garment,
    design: item.design,
    size: item.size ?? null,
    quantity,
    unit_amount: item.amount,
    line_total: item.amount * quantity,
  };
}

function OwnerCreateOrderView() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [selectedLookupKey, setSelectedLookupKey] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [orderItems, setOrderItems] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCountry, setAddressCountry] = useState("US");
  const [shippingMethod, setShippingMethod] = useState("Local drop-off");
  const [shippingAmount, setShippingAmount] = useState("0.00");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [discountMode, setDiscountMode] = useState(DISCOUNT_MODES.paidCash);
  const [discountValue, setDiscountValue] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setFormError(error.message);
      }

      setSession(data.session ?? null);
      setIsAuthLoading(false);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession ?? null);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let isMounted = true;

    const loadCatalog = async () => {
      setIsCatalogLoading(true);
      setCatalogError("");

      try {
        const catalog = await getSessionCatalog();
        if (!isMounted) {
          return;
        }

        const nextItems = catalog.items ?? [];
        setCatalogItems(nextItems);
        setSelectedLookupKey(nextItems[0]?.lookupKey ?? "");
      } catch (error) {
        if (isMounted) {
          setCatalogError(error instanceof Error ? error.message : "Unable to load catalog.");
        }
      } finally {
        if (isMounted) {
          setIsCatalogLoading(false);
        }
      }
    };

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const catalogByLookupKey = useMemo(() => {
    return new Map(catalogItems.map((item) => [item.lookupKey, item]));
  }, [catalogItems]);

  const subtotalAmount = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.amount * item.quantity, 0);
  }, [orderItems]);

  const discountAmount = useMemo(() => {
    if (discountMode === DISCOUNT_MODES.percent) {
      const percent = clamp(Number.parseFloat(discountValue) || 0, 0, 100);
      return Math.round(subtotalAmount * (percent / 100));
    }

    return parseDollarAmount(discountValue);
  }, [discountMode, discountValue, subtotalAmount]);

  const shippingAmountCents = parseDollarAmount(shippingAmount);
  const totalAmount = Math.max(0, subtotalAmount + shippingAmountCents - discountAmount);
  const currency = orderItems[0]?.currency ?? catalogItems[0]?.currency ?? "usd";

  const handleAddItem = () => {
    const selectedItem = catalogByLookupKey.get(selectedLookupKey);
    const quantity = clamp(Number.parseInt(selectedQuantity, 10) || 1, 1, 99);

    if (!selectedItem) {
      return;
    }

    setOrderItems((current) => {
      const existingItem = current.find((item) => item.lookupKey === selectedItem.lookupKey);

      if (existingItem) {
        return current.map((item) =>
          item.lookupKey === selectedItem.lookupKey
            ? { ...item, quantity: clamp(item.quantity + quantity, 1, 99) }
            : item,
        );
      }

      return [...current, { ...selectedItem, quantity }];
    });

    setSelectedQuantity(1);
    setFormError("");
  };

  const handleQuantityChange = (lookupKey, quantity) => {
    const nextQuantity = clamp(Number.parseInt(quantity, 10) || 1, 1, 99);
    setOrderItems((current) =>
      current.map((item) =>
        item.lookupKey === lookupKey ? { ...item, quantity: nextQuantity } : item,
      ),
    );
  };

  const handleRemoveItem = (lookupKey) => {
    setOrderItems((current) => current.filter((item) => item.lookupKey !== lookupKey));
  };

  const handleDiscountModeChange = (nextMode) => {
    setDiscountMode(nextMode);
    setDiscountValue(nextMode === DISCOUNT_MODES.percent ? "0" : "0.00");
  };

  const handleDiscountValueChange = (value) => {
    if (discountMode === DISCOUNT_MODES.percent) {
      setDiscountValue(value);
      return;
    }

    setDiscountValue(value);
  };

  const normalizeDiscountValue = () => {
    if (discountMode === DISCOUNT_MODES.percent) {
      setDiscountValue(String(clamp(Number.parseFloat(discountValue) || 0, 0, 100)));
      return;
    }

    setDiscountValue(getDollarInputValue(parseDollarAmount(discountValue)));
  };

  const normalizeShippingAmount = () => {
    setShippingAmount(getDollarInputValue(parseDollarAmount(shippingAmount)));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setFormMessage("");

    if (!session) {
      setFormError("You must be signed in to create an order.");
      return;
    }

    if (orderItems.length === 0) {
      setFormError("Add at least one item before creating the order.");
      return;
    }

    setIsSubmitting(true);

    const customerDetails = {
      email: trimToNull(customerEmail),
      name: trimToNull(customerName),
      phone: trimToNull(customerPhone),
    };
    const address = {
      line1: trimToNull(addressLine1),
      line2: trimToNull(addressLine2),
      city: trimToNull(addressCity),
      state: trimToNull(addressState),
      postal_code: trimToNull(addressPostalCode),
      country: trimToNull(addressCountry),
    };
    const hasAddress = Object.values(address).some(Boolean);
    const shippingDetails =
      hasAddress || customerDetails.name || customerDetails.phone
        ? {
            name: customerDetails.name,
            phone: customerDetails.phone,
            address: hasAddress ? address : null,
          }
        : null;
    const discountLabel =
      discountAmount > 0
        ? discountMode === DISCOUNT_MODES.percent
          ? `${clamp(Number.parseFloat(discountValue) || 0, 0, 100)}% Discount`
          : "Paid Cash"
        : null;
    const discountNote = discountLabel ? `${discountLabel} : ${formatMoney(discountAmount, currency)}` : null;
    const normalizedNotes = [discountNote, notes.trim()].filter(Boolean).join("\n\n") || null;

    const orderPayload = {
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      stripe_customer_id: null,
      customer_email: customerDetails.email,
      customer_name: customerDetails.name,
      currency,
      subtotal_amount: subtotalAmount,
      total_amount: totalAmount,
      paid: paymentStatus === "paid",
      payment_status: paymentStatus,
      shipping_amount: shippingAmountCents,
      shipping_method: shippingMethod.trim() || null,
      shipping_fulfillment_method: shippingMethod.trim() ? "manual" : null,
      status: "in_progress",
      is_closed: false,
      notes: normalizedNotes,
      raw_checkout_session: {
        source: "manual_order",
        customer_details: {
          ...customerDetails,
          address: hasAddress ? address : null,
        },
        shipping_details: shippingDetails,
        amount_subtotal: subtotalAmount,
        amount_total: totalAmount,
        shipping_cost: {
          amount_total: shippingAmountCents,
        },
        currency,
        discount: {
          mode: discountMode,
          amount_total: discountAmount,
          label: discountLabel,
        },
      },
    };

    const { data: createdOrder, error: orderError } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError || !createdOrder?.id) {
      setFormError(orderError?.message ?? "Unable to create order.");
      setIsSubmitting(false);
      return;
    }

    const itemRows = orderItems.map((item) =>
      buildOrderItemRow(createdOrder.id, item, item.quantity),
    );

    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);

    if (itemsError) {
      setFormError(`Order was created, but items could not be saved: ${itemsError.message}`);
      setIsSubmitting(false);
      return;
    }

    setFormMessage("Order created. Returning to orders...");
    setTimeout(() => navigateTo("/orders"), 500);
  };

  if (isAuthLoading) {
    return (
      <section className="view owner-orders-view">
        <div className="owner-orders-panel surface-card">
          <p>Checking owner access...</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="view owner-orders-view">
        <div className="owner-orders-panel surface-card">
          <div className="section-heading">
            <h2>Create new order</h2>
          </div>
          <p className="owner-orders-error">You must be signed in to create an order.</p>
          <a
            href="/orders"
            className="owner-orders-secondary owner-orders-button-link"
            onClick={(event) => handleAppLinkClick(event, "/orders")}
          >
            Sign in on orders page
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="view owner-orders-view">
      <div className="owner-orders-hero surface-card">
        <div className="section-heading">
          <h2>Create new order</h2>
        </div>
        <div className="owner-orders-toolbar">
          <p className="owner-orders-note">Signed in as {session.user.email}</p>
          <a
            href="/orders"
            className="owner-orders-secondary owner-orders-button-link"
            onClick={(event) => handleAppLinkClick(event, "/orders")}
          >
            Back to orders
          </a>
        </div>
      </div>

      <form className="owner-orders-card surface-card" onSubmit={handleSubmit}>
        <div className="owner-orders-details">
          <label className="owner-orders-field">
            <span>Customer name</span>
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </label>
          <label className="owner-orders-field">
            <span>Customer email</span>
            <input
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
            />
          </label>
          <label className="owner-orders-field">
            <span>Customer phone</span>
            <input
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(formatPhoneNumber(event.target.value))}
            />
          </label>
          <label className="owner-orders-field">
            <span>Delivery method</span>
            <input
              value={shippingMethod}
              onChange={(event) => setShippingMethod(event.target.value)}
            />
          </label>
          <label className="owner-orders-field">
            <span>Shipping amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={shippingAmount}
              onChange={(event) => setShippingAmount(event.target.value)}
              onBlur={normalizeShippingAmount}
            />
          </label>
          <label className="owner-orders-field">
            <span>Payment status</span>
            <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
              {PAYMENT_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="owner-orders-contents">
          <h2>Address</h2>
        </div>

        <div className="owner-orders-details">
          <label className="owner-orders-field owner-orders-details__wide">
            <span>Address line 1</span>
            <input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
          </label>
          <label className="owner-orders-field owner-orders-details__wide">
            <span>Address line 2</span>
            <input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
          </label>
          <label className="owner-orders-field">
            <span>City</span>
            <input value={addressCity} onChange={(event) => setAddressCity(event.target.value)} />
          </label>
          <label className="owner-orders-field">
            <span>State</span>
            <input value={addressState} onChange={(event) => setAddressState(event.target.value)} />
          </label>
          <label className="owner-orders-field">
            <span>ZIP / postal code</span>
            <input
              value={addressPostalCode}
              onChange={(event) => setAddressPostalCode(event.target.value)}
            />
          </label>
          <label className="owner-orders-field">
            <span>Country</span>
            <input value={addressCountry} onChange={(event) => setAddressCountry(event.target.value)} />
          </label>
        </div>

        <div className="owner-orders-contents">
          <h2>Items</h2>
        </div>

        <div className="owner-orders-manual-item-picker">
          <label className="owner-orders-field">
            <span>Catalog item</span>
            <select
              value={selectedLookupKey}
              onChange={(event) => setSelectedLookupKey(event.target.value)}
              disabled={isCatalogLoading || catalogItems.length === 0}
            >
              {catalogItems.map((item) => (
                <option key={item.lookupKey} value={item.lookupKey}>
                  {formatCatalogItemLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="owner-orders-field">
            <span>Qty</span>
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              value={selectedQuantity}
              onChange={(event) => setSelectedQuantity(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="owner-orders-secondary"
            onClick={handleAddItem}
            disabled={isCatalogLoading || catalogItems.length === 0}
          >
            Add item
          </button>
        </div>

        {catalogError ? <p className="owner-orders-error">{catalogError}</p> : null}

        {orderItems.length > 0 ? (
          <ul className="owner-orders-items">
            {orderItems.map((item) => (
              <li key={item.lookupKey} className="owner-orders-item">
                <div>
                  <strong>{formatCatalogItemLabel(item)}</strong>
                  <p className="owner-orders-item__quantity">
                    {formatMoney(item.amount, item.currency)} each
                  </p>
                </div>
                <div className="owner-orders-manual-line-controls">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    aria-label={`Quantity for ${item.name}`}
                    value={item.quantity}
                    onChange={(event) => handleQuantityChange(item.lookupKey, event.target.value)}
                  />
                  <strong>{formatMoney(item.amount * item.quantity, item.currency)}</strong>
                  <button
                    type="button"
                    className="owner-orders-secondary"
                    onClick={() => handleRemoveItem(item.lookupKey)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="owner-orders-note">No items added yet.</p>
        )}

        <div className="owner-orders-details">
          <label className="owner-orders-field">
            <span>Compensation</span>
            <select
              value={discountMode}
              onChange={(event) => handleDiscountModeChange(event.target.value)}
            >
              <option value={DISCOUNT_MODES.paidCash}>Paid Cash</option>
              <option value={DISCOUNT_MODES.percent}>Discount (%)</option>
            </select>
          </label>
          <label className="owner-orders-field">
            <span>Amount</span>
            <input
              type="number"
              min="0"
              max={discountMode === DISCOUNT_MODES.percent ? "100" : undefined}
              step={discountMode === DISCOUNT_MODES.percent ? "1" : "0.01"}
              value={discountValue}
              onChange={(event) => handleDiscountValueChange(event.target.value)}
              onBlur={normalizeDiscountValue}
            />
          </label>
        </div>

        <div className="owner-orders-meta owner-orders-manual-totals">
          <p>
            <span>Subtotal</span>
            <strong>{formatMoney(subtotalAmount, currency)}</strong>
          </p>
          <p>
            <span>Shipping</span>
            <strong>{formatMoney(shippingAmountCents, currency)}</strong>
          </p>
          <p>
            <span>Compensation</span>
            <strong>{formatMoney(discountAmount, currency)}</strong>
          </p>
          <p>
            <span>Total</span>
            <strong>{formatMoney(totalAmount, currency)}</strong>
          </p>
        </div>

        <label className="owner-orders-field">
          <span>Internal notes</span>
          <textarea
            rows="4"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add fulfillment notes, pickup details, or follow-up reminders."
          />
        </label>

        {formError ? <p className="owner-orders-error">{formError}</p> : null}
        {formMessage ? <p className="owner-orders-note">{formMessage}</p> : null}

        <div className="owner-orders-actions">
          <button
            type="submit"
            className="owner-orders-primary"
            disabled={isSubmitting || orderItems.length === 0}
          >
            {isSubmitting ? "Creating order..." : "Create order"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default OwnerCreateOrderView;

import { useEffect, useMemo, useRef, useState } from "react";
import { HiChevronDown, HiChevronUp } from "react-icons/hi2";
import { handleAppLinkClick } from "../lib/navigation.js";
import { supabase } from "../utils/supabase.ts";
import "./OwnerOrdersView.css";

const currencyFormatterCache = new Map();
const ORDER_TABS = [
  { key: "all", label: "All orders", countKey: "total" },
  { key: "open", label: "Open orders", countKey: "open" },
  { key: "closed", label: "Closed orders", countKey: "closed" },
  { key: "donations", label: "Donations", countKey: "donations" },
];
const CSV_COLUMNS = ["name", "item", "qty", "phone", "email", "delivery method"];

function formatCurrency(amount, currency) {
  const normalizedCurrency = (currency || "USD").toUpperCase();

  if (!currencyFormatterCache.has(normalizedCurrency)) {
    currencyFormatterCache.set(
      normalizedCurrency,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCurrency,
      }),
    );
  }

  return currencyFormatterCache.get(normalizedCurrency).format((amount || 0) / 100);
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPaymentSummary(order) {
  if (order.status === "refunded") {
    return "false";
  }

  if (order.status === "pending") {
    return "false";
  }

  if (order.status === "canceled") {
    return order.stripe_payment_intent_id ? "true" : "false";
  }

  return order.stripe_payment_intent_id ? "true" : "false";
}

function formatAddress(address) {
  if (!address) {
    return null;
  }

  return [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.postal_code, address.country].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

function getShippingAddress(order) {
  const session = order.raw_checkout_session ?? {};
  const shippingName =
    session.shipping_details?.name ??
    session.customer_details?.name ??
    order.customer_name ??
    null;
  const shippingAddress =
    formatAddress(session.shipping_details?.address) ??
    formatAddress(session.shipping?.address) ??
    formatAddress(session.customer_details?.address);

  if (!shippingName && !shippingAddress) {
    return "No shipping address captured";
  }

  return [shippingName, shippingAddress].filter(Boolean).join("\n");
}

function getShippingMethod(order) {
  if (order.shipping_method) {
    return order.shipping_method;
  }

  const shippingRate = order.raw_checkout_session?.shipping_cost?.shipping_rate;
  if (shippingRate && typeof shippingRate === "object" && shippingRate.display_name) {
    return shippingRate.display_name;
  }

  const shippingAmount = getShippingAmount(order);
  if (shippingAmount > 0) {
    return "Ship order";
  }

  if (order.raw_checkout_session?.shipping_details) {
    return "Local drop-off";
  }

  return "Not selected";
}

function getShippingAmount(order) {
  return order.shipping_amount ?? order.raw_checkout_session?.shipping_cost?.amount_total ?? 0;
}

function getCustomerPhone(order) {
  const session = order.raw_checkout_session ?? {};

  return (
    session.customer_details?.phone ??
    session.shipping_details?.phone ??
    (typeof session.customer === "object" ? session.customer?.phone : null) ??
    null
  );
}

function getPhoneHref(phone) {
  if (!phone) {
    return null;
  }

  const normalizedPhone = String(phone).replace(/[^\d+]/g, "");

  return normalizedPhone ? `tel:${normalizedPhone}` : null;
}

function formatSizeLabel(size) {
  if (!size) {
    return null;
  }

  const normalizedSize = String(size).toLowerCase();
  const sizeLabels = {
    s: "SMALL",
    m: "MEDIUM",
    l: "LARGE",
    xl: "XL",
    xxl: "XXL",
    xxxl: "XXXL",
  };

  return sizeLabels[normalizedSize] ?? String(size).toUpperCase();
}

function isDonationOrder(order) {
  const items = order.order_items ?? [];

  return items.length > 0 && items.every((item) => item.category === "donation");
}

function getCsvItemName(item) {
  const sizeLabel = item.category === "apparel" && item.size ? ` - ${formatSizeLabel(item.size)}` : "";
  return `${item.product_name}${sizeLabel}`;
}

function getOrderExportRows(order) {
  return (order.order_items ?? []).map((item) => [
    order.customer_name || "",
    getCsvItemName(item),
    item.quantity ?? 0,
    getCustomerPhone(order) || "",
    order.customer_email || "",
    getShippingMethod(order),
  ]);
}

function escapeXmlValue(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return stringValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toWorkbookXml(ordersToExport) {
  const rows = [CSV_COLUMNS, ...ordersToExport.flatMap((order) => getOrderExportRows(order))]
    .map(
      (row) =>
        `<Row>${row
          .map((value) => `<Cell><Data ss:Type="String">${escapeXmlValue(value)}</Data></Cell>`)
          .join("")}</Row>`,
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Worksheet ss:Name="Orders"><Table>${rows}</Table></Worksheet>
</Workbook>`;
}

function downloadWorkbook(filename, ordersToExport) {
  const xml = toWorkbookXml(ordersToExport);
  const blob = new Blob([xml], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getOrderWorkbookFilename(order) {
  const reference = order.stripe_checkout_session_id || order.id || "order";
  return `kblb-order-${reference}.xls`;
}

function OwnerOrdersView() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [orders, setOrders] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedStripeOrderIds, setExpandedStripeOrderIds] = useState({});
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [savingOrderIds, setSavingOrderIds] = useState({});
  const [saveMessages, setSaveMessages] = useState({});
  const autoSaveTimeoutsRef = useRef({});
  const draftsRef = useRef({});

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      const nextSession = data.session ?? null;

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(nextSession);
      if (!nextSession) {
        setOrders([]);
        setDrafts({});
        setOrdersError("");
      }
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
      if (!nextSession) {
        setOrders([]);
        setDrafts({});
        setOrdersError("");
      }
      setAuthError("");
      setAuthMessage("");
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timeoutRegistry = autoSaveTimeoutsRef.current;

    return () => {
      Object.values(timeoutRegistry).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let isMounted = true;

    const loadOrders = async () => {
      setIsOrdersLoading(true);
      setOrdersError("");

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          updated_at,
          customer_email,
          customer_name,
          currency,
          subtotal_amount,
          total_amount,
          shipping_amount,
          shipping_method,
          shipping_fulfillment_method,
          status,
          is_closed,
          notes,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          raw_checkout_session,
          order_items (
            id,
            product_name,
            category,
            garment,
            design,
            size,
            quantity,
            unit_amount,
            line_total
          )
        `)
        .order("created_at", { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error) {
        setOrdersError(error.message);
        setOrders([]);
        setDrafts({});
      } else {
        const nextOrders = data ?? [];

        setOrders(nextOrders);
        setDrafts(
          Object.fromEntries(
            nextOrders.map((order) => [
              order.id,
              {
                shipped: order.status === "fulfilled" ? "true" : "false",
                isClosed: order.is_closed ? "true" : "false",
                notes: order.notes ?? "",
              },
            ]),
          ),
        );
      }

      setIsOrdersLoading(false);
    };

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const orderSummary = useMemo(() => {
    return orders.reduce(
      (summary, order) => {
        if (isDonationOrder(order)) {
          summary.donations += 1;
        } else {
          summary.total += 1;
          summary.open += order.is_closed ? 0 : 1;
          summary.closed += order.is_closed ? 1 : 0;
          summary[order.status] = (summary[order.status] ?? 0) + 1;
        }
        return summary;
      },
      { total: 0, open: 0, closed: 0, donations: 0 },
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === "donations") {
      return orders.filter((order) => isDonationOrder(order));
    }

    const nonDonationOrders = orders.filter((order) => !isDonationOrder(order));

    if (activeFilter === "open") {
      return nonDonationOrders.filter((order) => !order.is_closed);
    }

    if (activeFilter === "closed") {
      return nonDonationOrders.filter((order) => order.is_closed);
    }

    return nonDonationOrders;
  }, [activeFilter, orders]);

  const exportableOrderGroups = useMemo(() => {
    const nonDonationOrders = orders.filter((order) => !isDonationOrder(order));

    return {
      all: nonDonationOrders,
      open: nonDonationOrders.filter((order) => !order.is_closed),
      closed: nonDonationOrders.filter((order) => order.is_closed),
    };
  }, [orders]);

  const handleDraftChange = (orderId, field, value) => {
    const nextDraft = {
      ...draftsRef.current[orderId],
      [field]: value,
    };

    setDrafts((current) => ({
      ...current,
      [orderId]: nextDraft,
    }));

    draftsRef.current = {
      ...draftsRef.current,
      [orderId]: nextDraft,
    };

    setSaveMessages((current) => ({
      ...current,
      [orderId]: "",
    }));

    if (autoSaveTimeoutsRef.current[orderId]) {
      clearTimeout(autoSaveTimeoutsRef.current[orderId]);
    }

    const delay = field === "notes" ? 700 : 0;
    autoSaveTimeoutsRef.current[orderId] = setTimeout(() => {
      handleSaveOrder(orderId, draftsRef.current[orderId]);
    }, delay);
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    setIsSigningIn(true);
    setAuthError("");
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthMessage("Signed in. Loading orders...");
      setPassword("");
    }

    setIsSigningIn(false);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setAuthError("");
    setAuthMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    }

    setIsSigningOut(false);
  };

  const refreshOrders = async () => {
    setIsOrdersLoading(true);
    setOrdersError("");

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        updated_at,
        customer_email,
        customer_name,
        currency,
        subtotal_amount,
        total_amount,
        shipping_amount,
        shipping_method,
        shipping_fulfillment_method,
        status,
        is_closed,
        notes,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        raw_checkout_session,
        order_items (
          id,
          product_name,
          category,
          garment,
          design,
          size,
          quantity,
          unit_amount,
          line_total
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setOrdersError(error.message);
      setOrders([]);
    } else {
      const nextOrders = data ?? [];
      setOrders(nextOrders);
      setDrafts(
        Object.fromEntries(
          nextOrders.map((order) => [
            order.id,
              {
                shipped: order.status === "fulfilled" ? "true" : "false",
                isClosed: order.is_closed ? "true" : "false",
                notes: order.notes ?? "",
              },
            ]),
        ),
      );
    }

    setIsOrdersLoading(false);
  };

  const handleSaveOrder = async (orderId, draftOverride) => {
    const draft = draftOverride ?? draftsRef.current[orderId];
    const order = orders.find((entry) => entry.id === orderId);

    if (!draft || !order) {
      return;
    }

    if (autoSaveTimeoutsRef.current[orderId]) {
      clearTimeout(autoSaveTimeoutsRef.current[orderId]);
      delete autoSaveTimeoutsRef.current[orderId];
    }

    setSavingOrderIds((current) => ({ ...current, [orderId]: true }));
    setSaveMessages((current) => ({ ...current, [orderId]: "Saving..." }));

    const { data, error } = await supabase
      .from("orders")
      .update({
        status:
          order.status === "canceled" || order.status === "refunded"
            ? order.status
            : draft.shipped === "true"
              ? "fulfilled"
              : "in_progress",
        is_closed: draft.isClosed === "true",
        notes: draft.notes.trim() || null,
      })
      .eq("id", orderId)
      .select("id, status, is_closed, notes, updated_at")
      .single();

    if (error) {
      setSaveMessages((current) => ({
        ...current,
        [orderId]: error.message,
      }));
    } else {
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: data.status,
                is_closed: data.is_closed,
                notes: data.notes,
                updated_at: data.updated_at,
              }
            : order,
        ),
      );

      setDrafts((current) => ({
        ...current,
        [orderId]: {
          shipped: data.status === "fulfilled" ? "true" : "false",
          isClosed: data.is_closed ? "true" : "false",
          notes: data.notes ?? "",
        },
      }));

      setSaveMessages((current) => ({
        ...current,
        [orderId]: "Saved automatically.",
      }));
    }

    setSavingOrderIds((current) => ({ ...current, [orderId]: false }));
  };

  const handleToggleClosed = async (orderId) => {
    const order = orders.find((entry) => entry.id === orderId);

    if (!order) {
      return;
    }

    const nextClosed = !order.is_closed;

    setSavingOrderIds((current) => ({ ...current, [orderId]: true }));
    setSaveMessages((current) => ({ ...current, [orderId]: "" }));

    const { data, error } = await supabase
      .from("orders")
      .update({ is_closed: nextClosed })
      .eq("id", orderId)
      .select("id, is_closed, updated_at")
      .single();

    if (error) {
      setSaveMessages((current) => ({
        ...current,
        [orderId]: error.message,
      }));
    } else {
      setOrders((current) =>
        current.map((entry) =>
          entry.id === orderId
            ? {
                ...entry,
                is_closed: data.is_closed,
                updated_at: data.updated_at,
              }
            : entry,
        ),
      );

      setDrafts((current) => ({
        ...current,
        [orderId]: {
          ...current[orderId],
          isClosed: data.is_closed ? "true" : "false",
        },
      }));

      setSaveMessages((current) => ({
        ...current,
        [orderId]: "",
      }));
    }

    setSavingOrderIds((current) => ({ ...current, [orderId]: false }));
  };

  const handleToggleStripeInfo = (orderId) => {
    setExpandedStripeOrderIds((current) => ({
      ...current,
      [orderId]: !current[orderId],
    }));
  };

  const handleExportOrderWorkbook = (order) => {
    downloadWorkbook(getOrderWorkbookFilename(order), [order]);
  };

  const handleExportOrderGroupWorkbook = (groupName) => {
    const ordersToExport = exportableOrderGroups[groupName] ?? [];
    downloadWorkbook(`kblb-orders-${groupName}.xls`, ordersToExport);
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
        <div className="section-heading">
          <h2>Order Management System</h2>
        </div>

        <form className="owner-orders-auth surface-card" onSubmit={handleSignIn}>
          <label className="owner-orders-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="owner-orders-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {authError ? <p className="owner-orders-error">{authError}</p> : null}
          {authMessage ? <p className="owner-orders-note">{authMessage}</p> : null}

          <button type="submit" className="owner-orders-primary" disabled={isSigningIn}>
            {isSigningIn ? "Signing in..." : "Sign in"}
          </button>
          <a
            href="/orders/password-reset"
            className="owner-orders-link"
            onClick={(event) => handleAppLinkClick(event, "/orders/password-reset")}
          >
            Forgot password?
          </a>
        </form>
      </section>
    );
  }

  return (
    <section className="view owner-orders-view">
      <div className="owner-orders-hero surface-card">
        <div className="section-heading">
          <h2>Order Management System</h2>
        </div>

        <div className="owner-orders-toolbar">
          <p className="owner-orders-note">Signed in as {session.user.email}</p>
          <div className="owner-orders-toolbar-actions">
            <button
              type="button"
              className="owner-orders-secondary"
              onClick={refreshOrders}
              disabled={isOrdersLoading}
            >
              {isOrdersLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              className="owner-orders-secondary"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </div>

      <div className="owner-orders-tabs" role="tablist" aria-label="Order views">
        {ORDER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`owner-orders-tab surface-card${isActive ? " is-active" : ""}`}
              onClick={() => setActiveFilter(tab.key)}
            >
              <span>{tab.label}</span>
              <strong>{orderSummary[tab.countKey]}</strong>
            </button>
          );
        })}
      </div>

      <div className="owner-orders-export-actions surface-card">
        <span>Export workbook</span>
        <div className="owner-orders-export-actions__buttons">
          <button
            type="button"
            className="owner-orders-secondary"
            onClick={() => handleExportOrderGroupWorkbook("all")}
            disabled={exportableOrderGroups.all.length === 0}
          >
            All orders
          </button>
          <button
            type="button"
            className="owner-orders-secondary"
            onClick={() => handleExportOrderGroupWorkbook("open")}
            disabled={exportableOrderGroups.open.length === 0}
          >
            Open orders
          </button>
          <button
            type="button"
            className="owner-orders-secondary"
            onClick={() => handleExportOrderGroupWorkbook("closed")}
            disabled={exportableOrderGroups.closed.length === 0}
          >
            Closed orders
          </button>
        </div>
      </div>

      {ordersError ? <p className="owner-orders-error surface-card">{ordersError}</p> : null}
      {!isOrdersLoading && filteredOrders.length === 0 ? (
        <div className="owner-orders-panel surface-card">
          <p>No orders in this view.</p>
        </div>
      ) : null}

      <div className="owner-orders-list">
        {filteredOrders.map((order) => {
          const isDonation = isDonationOrder(order);
          const draft = drafts[order.id] ?? {
            shipped: order.status === "fulfilled" ? "true" : "false",
            isClosed: order.is_closed ? "true" : "false",
            notes: order.notes ?? "",
          };
          const isSaving = Boolean(savingOrderIds[order.id]);
          const isStripeInfoExpanded = Boolean(expandedStripeOrderIds[order.id]);
          const customerPhone = getCustomerPhone(order);
          const customerPhoneHref = getPhoneHref(customerPhone);
          const shippingMethod = getShippingMethod(order);
          const shippingAmount = getShippingAmount(order);
          const itemCount = (order.order_items ?? []).reduce(
            (total, item) => total + (item.quantity ?? 0),
            0,
          );

          return (
            <article key={order.id} className="owner-orders-card surface-card">
              <div className="owner-orders-card__header">
                <div>
                  <h3>{order.customer_name || "Customer name unavailable"}</h3>
                  <p>
                    {order.customer_email ? (
                      <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>
                    ) : (
                      "No email on file"
                    )}
                  </p>
                  <p>
                    {customerPhoneHref ? (
                      <a href={customerPhoneHref}>{customerPhone}</a>
                    ) : (
                      "No phone on file"
                    )}
                  </p>
                </div>

                <div className="owner-orders-card__total">
                  <strong>{formatCurrency(order.total_amount, order.currency)}</strong>
                  <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
                </div>
              </div>

              <div className="owner-orders-meta">
                <p>
                  <span>Paid</span>
                  <strong>{getPaymentSummary(order)}</strong>
                </p>
                <p>
                  <span>Placed on</span>
                  <strong>{formatDateTime(order.created_at)}</strong>
                </p>
                <p>
                  <span>Status</span>
                  <strong>{order.is_closed ? "Closed" : "Open"}</strong>
                </p>
                <p>
                  <span>Updated on</span>
                  <strong>{formatDateTime(order.updated_at)}</strong>
                </p>
              </div>

              <div className="owner-orders-contents">
                <div className="owner-orders-section-header">
                  <h2>Stripe Info</h2>
                  <button
                    type="button"
                    className="owner-orders-collapse-toggle"
                    onClick={() => handleToggleStripeInfo(order.id)}
                    aria-expanded={isStripeInfoExpanded}
                    aria-label={isStripeInfoExpanded ? "Collapse Stripe Info" : "Expand Stripe Info"}
                  >
                    {isStripeInfoExpanded ? (
                      <>
                        <span>Collapse</span>
                        <HiChevronUp aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <span>Expand</span>
                        <HiChevronDown aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>
              {isStripeInfoExpanded ? (
                <div className="owner-orders-details">
                  <p className="owner-orders-details__wide">
                    <span>Checkout reference</span>
                    <strong>{order.stripe_checkout_session_id || "Not available"}</strong>
                  </p>
                  <p className="owner-orders-details__wide">
                    <span>Payment reference</span>
                    <strong>{order.stripe_payment_intent_id || "Not available"}</strong>
                  </p>
                </div>
              ) : null}

              <div className="owner-orders-details">
                <p className="owner-orders-details__wide">
                  <span>Shipping address</span>
                  <strong className="owner-orders-prewrap">{getShippingAddress(order)}</strong>
                </p>
                <p>
                  <span>Delivery method</span>
                  <strong>{shippingMethod}</strong>
                </p>
                <p>
                  <span>Shipping amount</span>
                  <strong>{formatCurrency(shippingAmount, order.currency)}</strong>
                </p>
                <label className="owner-orders-checkbox-row">
                  <span>Shipped</span>
                  <input
                    type="checkbox"
                    checked={draft.shipped === "true"}
                    onChange={(event) =>
                      handleDraftChange(order.id, "shipped", event.target.checked ? "true" : "false")
                    }
                    disabled={isDonation || order.status === "canceled" || order.status === "refunded"}
                  />
                </label>
              </div>

              <div className="owner-orders-contents">
                <h2>Order Contents</h2>
              </div>
              <ul className="owner-orders-items">
                {(order.order_items ?? []).map((item) => (
                  <li key={item.id} className="owner-orders-item">
                    <div>
                      <div className="owner-orders-item__title-row">
                        <strong>
                          {item.product_name}
                          {item.category === "apparel" && item.size
                            ? ` - ${formatSizeLabel(item.size)}`
                            : ""}
                        </strong>
                      </div>
                      <p className="owner-orders-item__quantity">Qty {item.quantity}</p>
                    </div>

                    <div className="owner-orders-item__pricing">
                      <strong>{formatCurrency(item.line_total, order.currency)}</strong>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="owner-orders-editor">
                <label className="owner-orders-field">
                  <span>Internal notes</span>
                  <textarea
                    rows="4"
                    value={draft.notes}
                    onChange={(event) => handleDraftChange(order.id, "notes", event.target.value)}
                    placeholder="Add fulfillment notes, pickup details, or follow-up reminders."
                  />
                </label>
              </div>

              <div className="owner-orders-actions">
                <div className="owner-orders-actions__buttons">
                  <button
                    type="button"
                    className="owner-orders-secondary"
                    onClick={() => handleExportOrderWorkbook(order)}
                  >
                    Export workbook
                  </button>
                  <button
                    type="button"
                    className={`owner-orders-closure-toggle${order.is_closed ? " is-closed" : ""}`}
                    onClick={() => handleToggleClosed(order.id)}
                    disabled={isSaving || isDonation}
                  >
                    {order.is_closed ? "Open This Order" : "Close This Order"}
                  </button>
                </div>
                {saveMessages[order.id] ? (
                  <p
                    className={
                      saveMessages[order.id] === "Saved automatically." || saveMessages[order.id] === "Saving..."
                        ? "owner-orders-note"
                        : "owner-orders-error"
                    }
                  >
                    {saveMessages[order.id]}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default OwnerOrdersView;

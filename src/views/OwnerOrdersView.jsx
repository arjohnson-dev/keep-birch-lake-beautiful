import { useEffect, useMemo, useRef, useState } from "react";
import { HiChevronDown, HiChevronUp, HiPlusSmall } from "react-icons/hi2";
import { handleAppLinkClick } from "../lib/navigation.js";
import { getSessionCatalog } from "../lib/shopCatalog.js";
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
const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial_payment", label: "Partial payment" },
  { value: "paid", label: "Paid" },
];
const PAYMENT_STATUS_LABELS = Object.fromEntries(
  PAYMENT_STATUS_OPTIONS.map((status) => [status.value, status.label]),
);

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
  return PAYMENT_STATUS_LABELS[order.payment_status] ?? (order.paid ? "Paid" : "Unpaid");
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

function hasStripeInfo(order) {
  return Boolean(
    (order.stripe_checkout_session_id && !String(order.stripe_checkout_session_id).startsWith("manual_")) ||
      order.stripe_payment_intent_id,
  );
}

function trimToNull(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
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

function formatPhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getAddressObject(order) {
  const session = order.raw_checkout_session ?? {};
  return (
    session.shipping_details?.address ??
    session.shipping?.address ??
    session.customer_details?.address ??
    {}
  );
}

function getEditableItemLabel(item) {
  return `${item.productName}${item.category === "apparel" && item.size ? ` - ${formatSizeLabel(item.size)}` : ""}`;
}

function getCatalogItemLabel(item) {
  return [
    item.name,
    item.category === "apparel" && item.size ? item.size.toUpperCase() : null,
    item.inStock ? null : "Out of stock",
  ].filter(Boolean).join(" - ");
}

function toDraftItem(item, currency) {
  return {
    draftId: item.id ?? item.lookup_key,
    lookupKey: item.lookup_key,
    stripePriceId: item.stripe_price_id,
    productName: item.product_name,
    category: item.category,
    garment: item.garment,
    design: item.design,
    size: item.size ?? null,
    quantity: item.quantity ?? 1,
    unitAmount: item.unit_amount ?? 0,
    lineTotal: item.line_total ?? (item.unit_amount ?? 0) * (item.quantity ?? 1),
    currency,
  };
}

function toCatalogDraftItem(item, quantity) {
  return {
    draftId: `${item.lookupKey}-${Date.now()}`,
    lookupKey: item.lookupKey,
    stripePriceId: item.priceId,
    productName: item.name,
    category: item.category,
    garment: item.garment,
    design: item.design,
    size: item.size ?? null,
    quantity,
    unitAmount: item.amount,
    lineTotal: item.amount * quantity,
    currency: item.currency,
  };
}

function getOrderDraft(order) {
  const address = getAddressObject(order);
  const phone = getCustomerPhone(order);
  return {
    shipped: order.status === "fulfilled" ? "true" : "false",
    isClosed: order.is_closed ? "true" : "false",
    notes: order.notes ?? "",
    paymentStatus: order.payment_status ?? (order.paid ? "paid" : "unpaid"),
    customerName: order.customer_name ?? "",
    customerEmail: order.customer_email ?? "",
    customerPhone: formatPhoneNumber(phone ?? ""),
    addressLine1: address.line1 ?? "",
    addressLine2: address.line2 ?? "",
    addressCity: address.city ?? "",
    addressState: address.state ?? "",
    addressPostalCode: address.postal_code ?? "",
    addressCountry: address.country ?? "US",
    shippingMethod: getShippingMethod(order) === "Not selected" ? "" : getShippingMethod(order),
    shippingAmount: getDollarInputValue(getShippingAmount(order)),
    items: (order.order_items ?? []).map((item) => toDraftItem(item, order.currency)),
    newItemLookupKey: "",
    newItemQuantity: 1,
  };
}

function getOrderItemRows(orderId, draft) {
  return draft.items.map((item) => ({
    order_id: orderId,
    lookup_key: item.lookupKey,
    stripe_price_id: item.stripePriceId,
    product_name: item.productName,
    category: item.category,
    garment: item.garment,
    design: item.design,
    size: item.size,
    quantity: item.quantity,
    unit_amount: item.unitAmount,
    line_total: item.unitAmount * item.quantity,
  }));
}

function getCompensationAmount(order, subtotalAmount) {
  const discount = order.raw_checkout_session?.discount;
  if (!discount || typeof discount !== "object") {
    return 0;
  }

  if (discount.mode === "percent" && typeof discount.label === "string") {
    const labelMatch = discount.label.match(/^([\d.]+)%/);
    const percent = Number.parseFloat(labelMatch?.[1] ?? "0");
    return Number.isFinite(percent) ? Math.round(subtotalAmount * (Math.min(Math.max(percent, 0), 100) / 100)) : 0;
  }

  return Math.max(0, discount.amount_total ?? 0);
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
  const [activeFilter, setActiveFilter] = useState("open");
  const [expandedStripeOrderIds, setExpandedStripeOrderIds] = useState({});
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [savingOrderIds, setSavingOrderIds] = useState({});
  const [saveMessages, setSaveMessages] = useState({});
  const [editingOrderIds, setEditingOrderIds] = useState({});
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
        setEditingOrderIds({});
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
        setEditingOrderIds({});
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
          paid,
          payment_status,
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
            lookup_key,
            stripe_price_id,
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
              getOrderDraft(order),
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

  useEffect(() => {
    if (!session) {
      return;
    }

    let isMounted = true;

    const loadCatalog = async () => {
      setCatalogError("");

      try {
        const catalog = await getSessionCatalog();
        if (isMounted) {
          setCatalogItems(catalog.items ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setCatalogError(error instanceof Error ? error.message : "Unable to load catalog.");
        }
      }
    };

    loadCatalog();

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

    if (["shipped", "isClosed", "notes"].includes(field)) {
      if (autoSaveTimeoutsRef.current[orderId]) {
        clearTimeout(autoSaveTimeoutsRef.current[orderId]);
      }

      const delay = field === "notes" ? 700 : 0;
      autoSaveTimeoutsRef.current[orderId] = setTimeout(() => {
        handleSaveOrder(orderId, draftsRef.current[orderId]);
      }, delay);
    } else {
      setSaveMessages((current) => ({
        ...current,
        [orderId]: "Unsaved edits.",
      }));
    }
  };

  const handleDraftPhoneChange = (orderId, value) => {
    handleDraftChange(orderId, "customerPhone", formatPhoneNumber(value));
  };

  const handleNormalizeDraftShippingAmount = (orderId) => {
    const draft = draftsRef.current[orderId];
    if (!draft) {
      return;
    }

    handleDraftChange(orderId, "shippingAmount", getDollarInputValue(parseDollarAmount(draft.shippingAmount)));
  };

  const handleDraftItemQuantityChange = (orderId, draftId, value) => {
    const quantity = Math.min(Math.max(Number.parseInt(value, 10) || 1, 1), 99);
    const draft = draftsRef.current[orderId];
    if (!draft) {
      return;
    }

    handleDraftChange(orderId, "items", draft.items.map((item) =>
      item.draftId === draftId
        ? {
            ...item,
            quantity,
            lineTotal: item.unitAmount * quantity,
          }
        : item,
    ));
  };

  const handleRemoveDraftItem = (orderId, draftId) => {
    const draft = draftsRef.current[orderId];
    if (!draft) {
      return;
    }

    handleDraftChange(orderId, "items", draft.items.filter((item) => item.draftId !== draftId));
  };

  const handleAddDraftItem = (orderId) => {
    const draft = draftsRef.current[orderId];
    const lookupKey = draft?.newItemLookupKey || catalogItems[0]?.lookupKey;
    const catalogItem = catalogItems.find((item) => item.lookupKey === lookupKey);
    const quantity = Math.min(Math.max(Number.parseInt(draft?.newItemQuantity, 10) || 1, 1), 99);

    if (!draft || !catalogItem) {
      return;
    }

    const existingItem = draft.items.find((item) => item.lookupKey === catalogItem.lookupKey);
    const nextItems = existingItem
      ? draft.items.map((item) =>
          item.lookupKey === catalogItem.lookupKey
            ? {
                ...item,
                quantity: Math.min(item.quantity + quantity, 99),
                lineTotal: item.unitAmount * Math.min(item.quantity + quantity, 99),
              }
            : item,
        )
      : [...draft.items, toCatalogDraftItem(catalogItem, quantity)];

    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...draft,
        items: nextItems,
        newItemQuantity: 1,
      },
    }));
    draftsRef.current = {
      ...draftsRef.current,
      [orderId]: {
        ...draft,
        items: nextItems,
        newItemQuantity: 1,
      },
    };
    setSaveMessages((current) => ({
      ...current,
      [orderId]: "Unsaved edits.",
    }));
  };

  const handleBeginEditOrder = (order) => {
    setDrafts((current) => ({
      ...current,
      [order.id]: getOrderDraft(order),
    }));
    draftsRef.current = {
      ...draftsRef.current,
      [order.id]: getOrderDraft(order),
    };
    setEditingOrderIds((current) => ({
      ...current,
      [order.id]: true,
    }));
    setSaveMessages((current) => ({
      ...current,
      [order.id]: "",
    }));
  };

  const handleCancelEditOrder = (order) => {
    if (autoSaveTimeoutsRef.current[order.id]) {
      clearTimeout(autoSaveTimeoutsRef.current[order.id]);
      delete autoSaveTimeoutsRef.current[order.id];
    }

    setDrafts((current) => ({
      ...current,
      [order.id]: getOrderDraft(order),
    }));
    draftsRef.current = {
      ...draftsRef.current,
      [order.id]: getOrderDraft(order),
    };
    setEditingOrderIds((current) => ({
      ...current,
      [order.id]: false,
    }));
    setSaveMessages((current) => ({
      ...current,
      [order.id]: "",
    }));
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
        paid,
        payment_status,
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
          lookup_key,
          stripe_price_id,
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
            getOrderDraft(order),
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

    if ((draft.items ?? []).length === 0) {
      setSaveMessages((current) => ({
        ...current,
        [orderId]: "Add at least one item before saving.",
      }));
      return;
    }

    setSavingOrderIds((current) => ({ ...current, [orderId]: true }));
    setSaveMessages((current) => ({ ...current, [orderId]: "Saving..." }));

    const subtotalAmount = draft.items.reduce(
      (total, item) => total + item.unitAmount * item.quantity,
      0,
    );
    const shippingAmount = parseDollarAmount(draft.shippingAmount);
    const compensationAmount = getCompensationAmount(order, subtotalAmount);
    const totalAmount = Math.max(0, subtotalAmount + shippingAmount - compensationAmount);
    const rawCheckoutSession = order.raw_checkout_session ?? {};
    const existingCustomerDetails = rawCheckoutSession.customer_details ?? {};
    const existingShippingDetails = rawCheckoutSession.shipping_details ?? {};
    const customerDetails = {
      ...existingCustomerDetails,
      email: trimToNull(draft.customerEmail),
      name: trimToNull(draft.customerName),
      phone: trimToNull(draft.customerPhone),
      address: {
        line1: trimToNull(draft.addressLine1),
        line2: trimToNull(draft.addressLine2),
        city: trimToNull(draft.addressCity),
        state: trimToNull(draft.addressState),
        postal_code: trimToNull(draft.addressPostalCode),
        country: trimToNull(draft.addressCountry),
      },
    };
    const shippingDetails = {
      ...existingShippingDetails,
      name: customerDetails.name,
      phone: customerDetails.phone,
      address: customerDetails.address,
    };
    const nextRawCheckoutSession = {
      ...rawCheckoutSession,
      customer_details: customerDetails,
      shipping_details: shippingDetails,
      amount_subtotal: subtotalAmount,
      amount_total: totalAmount,
      shipping_cost: {
        ...(rawCheckoutSession.shipping_cost ?? {}),
        amount_total: shippingAmount,
      },
      currency: order.currency,
    };
    const nextStatus =
      order.status === "canceled" || order.status === "refunded"
        ? order.status
        : draft.shipped === "true"
          ? "fulfilled"
          : "in_progress";

    const { data, error } = await supabase
      .from("orders")
      .update({
        customer_email: trimToNull(draft.customerEmail),
        customer_name: trimToNull(draft.customerName),
        subtotal_amount: subtotalAmount,
        total_amount: totalAmount,
        paid: draft.paymentStatus === "paid",
        payment_status: draft.paymentStatus,
        shipping_amount: shippingAmount,
        shipping_method: trimToNull(draft.shippingMethod),
        shipping_fulfillment_method: trimToNull(draft.shippingMethod) ? "manual" : null,
        raw_checkout_session: nextRawCheckoutSession,
        status: nextStatus,
        is_closed: draft.isClosed === "true",
        notes: draft.notes.trim() || null,
      })
      .eq("id", orderId)
      .select(`
        id,
        updated_at,
        customer_email,
        customer_name,
        currency,
        subtotal_amount,
        total_amount,
        paid,
        payment_status,
        shipping_amount,
        shipping_method,
        shipping_fulfillment_method,
        status,
        is_closed,
        notes,
        raw_checkout_session
      `)
      .single();

    if (error) {
      setSaveMessages((current) => ({
        ...current,
        [orderId]: error.message,
      }));
    } else {
      const { error: deleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (deleteError) {
        setSaveMessages((current) => ({
          ...current,
          [orderId]: deleteError.message,
        }));
        setSavingOrderIds((current) => ({ ...current, [orderId]: false }));
        return;
      }

      const itemRows = getOrderItemRows(orderId, draft);
      const { data: savedItems, error: insertError } = await supabase
        .from("order_items")
        .insert(itemRows)
        .select(`
          id,
          lookup_key,
          stripe_price_id,
          product_name,
          category,
          garment,
          design,
          size,
          quantity,
          unit_amount,
          line_total
        `);

      if (insertError) {
        setSaveMessages((current) => ({
          ...current,
          [orderId]: insertError.message,
        }));
        setSavingOrderIds((current) => ({ ...current, [orderId]: false }));
        return;
      }

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                customer_email: data.customer_email,
                customer_name: data.customer_name,
                subtotal_amount: data.subtotal_amount,
                total_amount: data.total_amount,
                paid: data.paid,
                payment_status: data.payment_status,
                shipping_amount: data.shipping_amount,
                shipping_method: data.shipping_method,
                shipping_fulfillment_method: data.shipping_fulfillment_method,
                status: data.status,
                is_closed: data.is_closed,
                notes: data.notes,
                raw_checkout_session: data.raw_checkout_session,
                updated_at: data.updated_at,
                order_items: savedItems ?? [],
              }
            : order,
        ),
      );

      const nextOrder = {
        ...order,
        ...data,
        order_items: savedItems ?? [],
      };
      setDrafts((current) => ({
        ...current,
        [orderId]: getOrderDraft(nextOrder),
      }));

      setSaveMessages((current) => ({
        ...current,
        [orderId]: draftOverride ? "Saved automatically." : "Order edits saved.",
      }));

      if (!draftOverride) {
        setEditingOrderIds((current) => ({
          ...current,
          [orderId]: false,
        }));
      }
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
        <div className="owner-orders-export-group">
          <span>Export to Excel</span>
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
        <span className="owner-orders-tool-divider" aria-hidden="true">
          |
        </span>
        <div className="owner-orders-create-actions">
          <a
            href="/orders/new"
            className="owner-orders-secondary owner-orders-button-link owner-orders-create-link"
            onClick={(event) => handleAppLinkClick(event, "/orders/new")}
          >
            <HiPlusSmall aria-hidden="true" />
            Create new order
          </a>
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
            paymentStatus: order.payment_status ?? (order.paid ? "paid" : "unpaid"),
            customerName: order.customer_name ?? "",
            customerEmail: order.customer_email ?? "",
            customerPhone: formatPhoneNumber(getCustomerPhone(order) ?? ""),
            shippingMethod: getShippingMethod(order) === "Not selected" ? "" : getShippingMethod(order),
            shippingAmount: getDollarInputValue(getShippingAmount(order)),
            addressLine1: getAddressObject(order).line1 ?? "",
            addressLine2: getAddressObject(order).line2 ?? "",
            addressCity: getAddressObject(order).city ?? "",
            addressState: getAddressObject(order).state ?? "",
            addressPostalCode: getAddressObject(order).postal_code ?? "",
            addressCountry: getAddressObject(order).country ?? "US",
            items: (order.order_items ?? []).map((item) => toDraftItem(item, order.currency)),
            newItemLookupKey: "",
            newItemQuantity: 1,
          };
          const isSaving = Boolean(savingOrderIds[order.id]);
          const isStripeInfoExpanded = Boolean(expandedStripeOrderIds[order.id]);
          const isEditingOrder = Boolean(editingOrderIds[order.id]);
          const shippingAmount = isEditingOrder
            ? parseDollarAmount(draft.shippingAmount)
            : getShippingAmount(order);
          const itemCount = (draft.items ?? []).reduce(
            (total, item) => total + (item.quantity ?? 0),
            0,
          );
          const draftSubtotal = (draft.items ?? []).reduce(
            (total, item) => total + item.unitAmount * item.quantity,
            0,
          );
          const draftTotal = Math.max(
            0,
            draftSubtotal + shippingAmount - getCompensationAmount(order, draftSubtotal),
          );
          const shouldShowStripeInfo = hasStripeInfo(order);
          const customerPhone = getCustomerPhone(order);
          const customerPhoneHref = getPhoneHref(customerPhone);

          return (
            <article key={order.id} className="owner-orders-card surface-card">
              <div className="owner-orders-card__header">
                {isEditingOrder ? (
                  <div className="owner-orders-edit-grid">
                    <label className="owner-orders-field">
                      <span>Name</span>
                      <input
                        value={draft.customerName}
                        onChange={(event) => handleDraftChange(order.id, "customerName", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={draft.customerEmail}
                        onChange={(event) => handleDraftChange(order.id, "customerEmail", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>Phone</span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={draft.customerPhone}
                        onChange={(event) => handleDraftPhoneChange(order.id, event.target.value)}
                      />
                    </label>
                  </div>
                ) : (
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
                )}

                <div className="owner-orders-card__total">
                  <strong>{formatCurrency(isEditingOrder ? draftTotal : order.total_amount, order.currency)}</strong>
                  <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
                </div>
              </div>

              <div className="owner-orders-meta">
                <p>
                  <span>Payment status</span>
                  {isEditingOrder ? (
                    <select
                      className="owner-orders-inline-select"
                      value={draft.paymentStatus}
                      onChange={(event) => handleDraftChange(order.id, "paymentStatus", event.target.value)}
                    >
                      {PAYMENT_STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <strong>{getPaymentSummary(order)}</strong>
                  )}
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

              {shouldShowStripeInfo ? (
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
              ) : null}
              {shouldShowStripeInfo && isStripeInfoExpanded ? (
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
                {isEditingOrder ? (
                  <>
                    <label className="owner-orders-field owner-orders-details__wide">
                      <span>Address line 1</span>
                      <input
                        value={draft.addressLine1}
                        onChange={(event) => handleDraftChange(order.id, "addressLine1", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field owner-orders-details__wide">
                      <span>Address line 2</span>
                      <input
                        value={draft.addressLine2}
                        onChange={(event) => handleDraftChange(order.id, "addressLine2", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>City</span>
                      <input
                        value={draft.addressCity}
                        onChange={(event) => handleDraftChange(order.id, "addressCity", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>State</span>
                      <input
                        value={draft.addressState}
                        onChange={(event) => handleDraftChange(order.id, "addressState", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>ZIP / postal code</span>
                      <input
                        value={draft.addressPostalCode}
                        onChange={(event) => handleDraftChange(order.id, "addressPostalCode", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>Country</span>
                      <input
                        value={draft.addressCountry}
                        onChange={(event) => handleDraftChange(order.id, "addressCountry", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>Delivery method</span>
                      <input
                        value={draft.shippingMethod}
                        onChange={(event) => handleDraftChange(order.id, "shippingMethod", event.target.value)}
                      />
                    </label>
                    <label className="owner-orders-field">
                      <span>Shipping amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.shippingAmount}
                        onChange={(event) => handleDraftChange(order.id, "shippingAmount", event.target.value)}
                        onBlur={() => handleNormalizeDraftShippingAmount(order.id)}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <p className="owner-orders-details__wide">
                      <span>Shipping address</span>
                      <strong className="owner-orders-prewrap">{getShippingAddress(order)}</strong>
                    </p>
                    <p>
                      <span>Delivery method</span>
                      <strong>{getShippingMethod(order)}</strong>
                    </p>
                    <p>
                      <span>Shipping amount</span>
                      <strong>{formatCurrency(shippingAmount, order.currency)}</strong>
                    </p>
                  </>
                )}
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
                {(isEditingOrder ? draft.items : (order.order_items ?? []).map((item) => toDraftItem(item, order.currency))).map((item) => (
                  <li key={item.draftId} className="owner-orders-item">
                    <div>
                      <div className="owner-orders-item__title-row">
                        <strong>{getEditableItemLabel(item)}</strong>
                      </div>
                      <p className="owner-orders-item__quantity">Qty {item.quantity}</p>
                    </div>

                    {isEditingOrder ? (
                      <div className="owner-orders-manual-line-controls">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          step="1"
                          aria-label={`Quantity for ${item.productName}`}
                          value={item.quantity}
                          onChange={(event) =>
                            handleDraftItemQuantityChange(order.id, item.draftId, event.target.value)
                          }
                        />
                        <strong>{formatCurrency(item.unitAmount * item.quantity, order.currency)}</strong>
                        <button
                          type="button"
                          className="owner-orders-secondary"
                          onClick={() => handleRemoveDraftItem(order.id, item.draftId)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="owner-orders-item__pricing">
                        <strong>{formatCurrency(item.unitAmount * item.quantity, order.currency)}</strong>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {isEditingOrder ? (
                <>
                  <div className="owner-orders-manual-item-picker">
                    <label className="owner-orders-field">
                      <span>Add item</span>
                      <select
                        value={draft.newItemLookupKey || catalogItems[0]?.lookupKey || ""}
                        onChange={(event) => handleDraftChange(order.id, "newItemLookupKey", event.target.value)}
                        disabled={catalogItems.length === 0}
                      >
                        {catalogItems.map((item) => (
                          <option key={item.lookupKey} value={item.lookupKey}>
                            {getCatalogItemLabel(item)}
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
                        value={draft.newItemQuantity}
                        onChange={(event) => handleDraftChange(order.id, "newItemQuantity", event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="owner-orders-secondary"
                      onClick={() => handleAddDraftItem(order.id)}
                      disabled={catalogItems.length === 0}
                    >
                      Add item
                    </button>
                  </div>
                  {catalogError ? <p className="owner-orders-error">{catalogError}</p> : null}
                </>
              ) : null}

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
                <div className="owner-orders-action-message" aria-live="polite">
                  {saveMessages[order.id] ? (
                    <p
                      className={
                        saveMessages[order.id] === "Saved automatically." ||
                        saveMessages[order.id] === "Saving..." ||
                        saveMessages[order.id] === "Order edits saved." ||
                        saveMessages[order.id] === "Unsaved edits."
                          ? "owner-orders-note"
                          : "owner-orders-error"
                      }
                    >
                      {saveMessages[order.id]}
                    </p>
                  ) : null}
                </div>
                <div className="owner-orders-actions__buttons">
                  {isEditingOrder ? (
                    <>
                      <button
                        type="button"
                        className="owner-orders-primary"
                        onClick={() => handleSaveOrder(order.id)}
                        disabled={isSaving}
                      >
                        Save order edits
                      </button>
                      <button
                        type="button"
                        className="owner-orders-secondary"
                        onClick={() => handleCancelEditOrder(order)}
                        disabled={isSaving}
                      >
                        Cancel edits
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="owner-orders-secondary"
                      onClick={() => handleBeginEditOrder(order)}
                    >
                      Edit order
                    </button>
                  )}
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
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default OwnerOrdersView;

import { useEffect, useState } from "react";
import { useCart } from "../context/CartContext.jsx";
import { requestJson } from "../lib/api.js";
import "./ThankYouView.css";

const MAX_POLL_ATTEMPTS = 10;
const DEFAULT_POLL_DELAY_MS = 1500;

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
  }).format((amount || 0) / 100);
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

function isManualShippingOrder(order) {
  if (order.shippingFulfillmentMethod === "manual_shipping") {
    return true;
  }

  return /^ship\b/i.test(order.shippingMethod || "");
}

function buildReceiptText(order) {
  const shippingNote = isManualShippingOrder(order)
    ? [
        "",
        "Shipping note: We will contact you within the next 24 hours to confirm your shipping method.",
      ]
    : [];
  const lines = [
    "KEEP BIRCH LAKE BEAUTIFUL",
    "Order Summary",
    "",
    `Order reference: ${order.checkoutReference}`,
    `Placed on: ${formatDateTime(order.placedAt)}`,
    `Email: ${order.customerEmail || "No email on file"}`,
    "",
    "Ship to:",
    order.shippingAddress || "No shipping address captured",
    `Delivery method: ${order.shippingMethod || "Not selected"}`,
    ...shippingNote,
    "",
    "Items:",
    ...order.items.map((item) => {
      const title = `${item.productName}${item.sizeLabel ? ` - ${item.sizeLabel}` : ""}`;
      const quantity = `Qty ${item.quantity}`;
      const total = formatCurrency(item.lineTotal, order.currency);
      return `${title} | ${quantity} | ${total}`;
    }),
    "",
    `Subtotal: ${formatCurrency(order.subtotalAmount, order.currency)}`,
    `Shipping: ${formatCurrency(order.shippingAmount, order.currency)}`,
    `Total: ${formatCurrency(order.totalAmount, order.currency)}`,
    "",
    "Thank you for supporting Birch Lake.",
  ];

  return lines.join("\n");
}

function downloadReceipt(order) {
  const content = buildReceiptText(order);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `kblb-order-summary-${order.checkoutReference || "order"}.txt`;

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ThankYouView() {
  const { clearCart } = useCart();
  const [summaryState, setSummaryState] = useState({
    errorMessage: "",
    isLoading: false,
    order: null,
    sessionId: null,
  });
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  const isCurrentSummary = summaryState.sessionId === sessionId;
  const order = isCurrentSummary ? summaryState.order : null;
  const errorMessage = isCurrentSummary ? summaryState.errorMessage : "";
  const isLoadingSummary = isCurrentSummary ? summaryState.isLoading : false;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    clearCart();

    let isActive = true;
    let timeoutId;

    const loadSummary = async (attempt = 0) => {
      if (!isActive) {
        return;
      }

      if (attempt === 0) {
        setSummaryState({
          errorMessage: "",
          isLoading: true,
          order: null,
          sessionId,
        });
      } else {
        setSummaryState((current) => ({
          errorMessage: "",
          isLoading: true,
          order: current.sessionId === sessionId ? current.order : null,
          sessionId,
        }));
      }

      try {
        const payload = await requestJson(
          `/api/shop/order-summary?session_id=${encodeURIComponent(sessionId)}`,
        );

        if (!isActive) {
          return;
        }

        if (payload.ready && payload.order) {
          setSummaryState({
            errorMessage: "",
            isLoading: false,
            order: payload.order,
            sessionId,
          });
          return;
        }

        if (attempt < MAX_POLL_ATTEMPTS - 1) {
          timeoutId = window.setTimeout(
            () => loadSummary(attempt + 1),
            typeof payload.pollAfterMs === "number" ? payload.pollAfterMs : DEFAULT_POLL_DELAY_MS,
          );
          return;
        }

        setSummaryState({
          errorMessage:
            "Your payment was confirmed, but the order summary is still finalizing. Please refresh this page in a moment.",
          isLoading: false,
          order: null,
          sessionId,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSummaryState({
          errorMessage:
            error instanceof Error ? error.message : "Unable to load your order summary right now.",
          isLoading: false,
          order: null,
          sessionId,
        });
      }
    };

    loadSummary();

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [clearCart, sessionId]);

  return (
    <section id="thank-you" className="view thank-you-view">
      <div className="section-heading">
        <h2>Your order is confirmed!</h2>
        <p>
          Thank you for supporting Keep Birch Lake Beautiful. View your order summary below.
        </p>
      </div>

      {isLoadingSummary ? (
        <div className="thank-you-panel surface-card">
          <p>Finalizing your order summary...</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="thank-you-panel surface-card">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {order ? (
        <>
          <article className="thank-you-receipt surface-card">
            <div className="thank-you-receipt__header">
              <div className="thank-you-receipt__brand">
                <h2>Order Summary</h2>
              </div>
            </div>

            <div className="thank-you-grid thank-you-grid--receipt">
              <div className="thank-you-summary-row">
                <span className="thank-you-label">Order reference</span>
                <strong>{order.checkoutReference}</strong>
              </div>
              <div className="thank-you-summary-row">
                <span className="thank-you-label">Placed on</span>
                <strong>{formatDateTime(order.placedAt)}</strong>
              </div>
              <div className="thank-you-summary-row">
                <span className="thank-you-label">Email</span>
                <strong>{order.customerEmail || "No email on file"}</strong>
              </div>
              <div className="thank-you-summary-row">
                <span className="thank-you-label">Ship to</span>
                <strong className="thank-you-prewrap">
                  {order.shippingAddress || "No shipping address captured"}
                </strong>
              </div>
              <div className="thank-you-summary-row">
                <span className="thank-you-label">Delivery method</span>
                <strong>{order.shippingMethod || "Not selected"}</strong>
              </div>
            </div>

            {isManualShippingOrder(order) ? (
              <p className="thank-you-note">
                We will contact you within the next 24 hours to confirm your shipping method.
              </p>
            ) : null}

            <div className="thank-you-receipt__table">
              <div className="thank-you-receipt__table-head">
                <span>Item</span>
                <span>Qty</span>
                <span>Total</span>
              </div>

              <ul className="thank-you-items">
                {order.items.map((item) => (
                  <li key={item.id} className="thank-you-item">
                    <div className="thank-you-item__meta">
                      <strong>
                        {item.productName}
                        {item.sizeLabel ? ` - ${item.sizeLabel}` : ""}
                      </strong>
                      <span className="thank-you-item__quantity">
                        {item.category === "donation" ? "Contribution" : "Merchandise"}
                      </span>
                    </div>

                    <div className="thank-you-item__count">{item.quantity}</div>

                    <div className="thank-you-item__pricing">
                      <strong>{formatCurrency(item.lineTotal, order.currency)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="thank-you-totals">
              <p>
                <span>Subtotal</span>
                <strong>{formatCurrency(order.subtotalAmount, order.currency)}</strong>
              </p>
              <p>
                <span>Shipping</span>
                <strong>{formatCurrency(order.shippingAmount, order.currency)}</strong>
              </p>
              <p>
                <span>Total paid</span>
                <strong className="thank-you-total">
                  {formatCurrency(order.totalAmount, order.currency)}
                </strong>
              </p>
            </div>

            <p className="thank-you-note">
              A confirmation email should arrive shortly if one was provided at checkout.
            </p>
            <button
              type="button"
              className="thank-you-download-button"
              onClick={() => downloadReceipt(order)}
            >
              Download Order Summary
            </button>
          </article>
        </>
      ) : null}
    </section>
  );
}

export default ThankYouView;

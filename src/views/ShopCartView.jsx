import { useMemo, useState } from "react";
import CartLineItem from "../components/shop/CartLineItem.jsx";
import { useCart } from "../context/CartContext.jsx";
import { redirectToCheckout } from "../lib/checkout.js";
import { handleAppLinkClick } from "../lib/navigation.js";

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function ShopCartView() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const currency = useMemo(() => items[0]?.currency ?? "usd", [items]);
  const query = new URLSearchParams(window.location.search);
  const checkoutCancelled = query.get("checkout") === "cancelled";

  const handleCheckout = async () => {
    if (items.length === 0 || isCheckingOut) {
      return;
    }

    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      await redirectToCheckout(items);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Could not start checkout. Please try again.",
      );
      setIsCheckingOut(false);
    }
  };

  return (
    <section id="shop-cart" className="view shop-cart-view">
      <div className="section-heading">
        <p className="eyebrow">Cart</p>
        <h2>Your Cart</h2>
        <p>Review items, then continue shopping or proceed to checkout.</p>
      </div>

      {checkoutCancelled ? (
        <p className="shop-alert" role="status">
          Checkout was canceled. You can continue shopping or proceed to checkout.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="shop-cart-empty">
          <p>Your cart is empty.</p>
          <a href="/shop" onClick={(event) => handleAppLinkClick(event, "/shop")}>
            Continue shopping
          </a>
        </div>
      ) : (
        <div className="shop-cart-layout">
          <ul className="shop-cart-lines">
            {items.map((item) => (
              <CartLineItem
                key={item.id}
                item={item}
                onIncrement={() => updateQuantity(item.lookupKey, item.quantity + 1)}
                onDecrement={() => updateQuantity(item.lookupKey, item.quantity - 1)}
                onRemove={() => removeItem(item.lookupKey)}
              />
            ))}
          </ul>

          <aside className="shop-cart-summary">
            <div className="shop-cart-summary__row">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal, currency)}</strong>
            </div>

            {checkoutError ? (
              <p role="alert" className="shop-cart-summary__error">
                {checkoutError}
              </p>
            ) : null}

            <a href="/shop" className="shop-cart-summary__secondary" onClick={(event) => handleAppLinkClick(event, "/shop")}>
              Continue shopping
            </a>

            <button
              type="button"
              className="shop-cart-summary__checkout"
              disabled={items.length === 0 || isCheckingOut}
              onClick={handleCheckout}
            >
              {isCheckingOut ? "Redirecting to Checkout..." : "Proceed to checkout"}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}

export default ShopCartView;

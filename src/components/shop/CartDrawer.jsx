import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../../context/CartContext.jsx";
import { redirectToCheckout } from "../../lib/checkout.js";
import CartLineItem from "./CartLineItem.jsx";
import CartSummary from "./CartSummary.jsx";

function CartDrawer() {
  const {
    items,
    subtotal,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
  } = useCart();
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const closeButtonRef = useRef(null);

  const currency = useMemo(() => items[0]?.currency ?? "usd", [items]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeCart();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeCart, isOpen]);

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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button
        type="button"
        className="cart-drawer__backdrop"
        onClick={closeCart}
        aria-label="Close cart"
      />

      <aside className="cart-drawer__panel">
        <header className="cart-drawer__header">
          <h2>Your cart</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="cart-drawer__close"
            onClick={closeCart}
            aria-label="Close cart"
          >
            x
          </button>
        </header>

        {items.length === 0 ? (
          <div className="cart-drawer__empty">
            <p>Your cart is empty.</p>
            <p>Add a product from the shop to get started.</p>
          </div>
        ) : (
          <>
            <ul className="cart-drawer__lines">
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

            <CartSummary
              subtotal={subtotal}
              currency={currency}
              disabled={items.length === 0}
              isLoading={isCheckingOut}
              onCheckout={handleCheckout}
              error={checkoutError}
            />
          </>
        )}
      </aside>
    </div>
  );
}

export default CartDrawer;

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function CartSummary({ subtotal, currency, disabled, isLoading, onCheckout, error }) {
  return (
    <div className="cart-summary">
      <div className="cart-summary__row">
        <span>Subtotal</span>
        <strong>{formatMoney(subtotal, currency)}</strong>
      </div>

      {error ? (
        <p role="alert" className="cart-summary__error">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="cart-summary__checkout"
        disabled={disabled || isLoading}
        onClick={onCheckout}
      >
        {isLoading ? "Redirecting to Checkout..." : "Checkout"}
      </button>
    </div>
  );
}

export default CartSummary;

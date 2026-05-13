function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getItemMeta(item) {
  if (item.category === "print") {
    return `Print · ${item.design}`;
  }

  return [item.garment, item.design, item.size].filter(Boolean).join(" · ");
}

function CartLineItem({ item, onIncrement, onDecrement, onRemove }) {
  const lineSubtotal = item.unitAmount * item.quantity;

  return (
    <li className="cart-line-item">
      <div className="cart-line-item__copy">
        <p className="cart-line-item__name">{item.name}</p>
        <p className="cart-line-item__meta">
          {getItemMeta(item)}
        </p>
      </div>

      <div className="cart-line-item__controls">
        <button
          type="button"
          className="cart-line-item__qty-btn"
          onClick={onDecrement}
          aria-label={`Decrease quantity for ${item.name}`}
        >
          -
        </button>
        <span className="cart-line-item__qty" aria-live="polite">
          {item.quantity}
        </span>
        <button
          type="button"
          className="cart-line-item__qty-btn"
          onClick={onIncrement}
          aria-label={`Increase quantity for ${item.name}`}
        >
          +
        </button>
      </div>

      <div className="cart-line-item__pricing">
        <p>{formatMoney(lineSubtotal, item.currency)}</p>
        <button
          type="button"
          className="cart-line-item__remove"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export default CartLineItem;

import { useState } from "react";
import { useCart } from "../../context/CartContext.jsx";
import { humanizeToken } from "../../lib/shopProducts.js";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

function ProductPurchasePanel({ product, onAdded }) {
  const { addItem, openCart } = useCart();
  const [size, setSize] = useState(product.defaultSize);
  const [quantity, setQuantity] = useState(1);

  const hasSizes = product.sizes.length > 0;
  const inStockSizes = hasSizes
    ? product.sizes.filter((option) => Boolean(product.sizeItems[option]?.inStock))
    : [];
  const selectedSize = hasSizes
    ? (product.sizeItems[size]?.inStock
      ? size
      : inStockSizes[0] ?? product.defaultSize ?? product.sizes[0] ?? "")
    : "";
  const selectedItem = hasSizes
    ? product.sizeItems[selectedSize] ?? null
    : product.baseItem;
  const isSoldOut = !selectedItem || !selectedItem.inStock;

  const handleAddToCart = () => {
    if (!selectedItem || isSoldOut) {
      return;
    }

    addItem({
      id: selectedItem.lookupKey,
      priceId: selectedItem.priceId,
      lookupKey: selectedItem.lookupKey,
      name: selectedItem.name,
      category: selectedItem.category,
      garment: selectedItem.garment,
      design: selectedItem.design,
      size: selectedItem.size,
      unitAmount: selectedItem.amount,
      currency: selectedItem.currency,
      quantity,
    });

    const message = `${quantity} x ${humanizeToken(product.design)} added to cart.`;

    if (onAdded) {
      onAdded({
        message,
        quantity,
        selectedItem,
      });
      return;
    }

    openCart();
  };

  const handleQuantityChange = (nextValue) => {
    const normalized = Math.max(
      MIN_QUANTITY,
      Math.min(MAX_QUANTITY, Math.floor(Number(nextValue) || MIN_QUANTITY)),
    );
    setQuantity(normalized);
  };

  return (
    <div className="shop-purchase-panel" key={product.key}>
      {hasSizes ? (
        <label className="shop-product-card__field" htmlFor={`size-${product.key}`}>
          <span>Size</span>
          <select id={`size-${product.key}`} value={selectedSize} onChange={(event) => setSize(event.target.value)}>
            {product.sizes.map((option) => (
              <option key={option} value={option} disabled={!product.sizeItems[option]?.inStock}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="shop-product-card__field" htmlFor={`qty-${product.key}`}>
        <span>Quantity</span>
        <div className="shop-quantity-input">
          <button
            type="button"
            className="shop-quantity-input__button"
            onClick={() => handleQuantityChange(quantity - 1)}
            aria-label="Decrease quantity"
            disabled={isSoldOut}
          >
            -
          </button>
          <input
            id={`qty-${product.key}`}
            type="number"
            inputMode="numeric"
            min={MIN_QUANTITY}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(event) => handleQuantityChange(event.target.value)}
            disabled={isSoldOut}
          />
          <button
            type="button"
            className="shop-quantity-input__button"
            onClick={() => handleQuantityChange(quantity + 1)}
            aria-label="Increase quantity"
            disabled={isSoldOut}
          >
            +
          </button>
        </div>
      </label>

      <button type="button" className="shop-product-card__add" onClick={handleAddToCart} disabled={isSoldOut}>
        {isSoldOut ? "SOLD OUT" : "Add to cart"}
      </button>
    </div>
  );
}

export default ProductPurchasePanel;

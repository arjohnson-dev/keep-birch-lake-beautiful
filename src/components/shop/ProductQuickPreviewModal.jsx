import { useEffect, useRef } from "react";
import ProductGallery from "./ProductGallery.jsx";
import ProductPurchasePanel from "./ProductPurchasePanel.jsx";
import { getPriceLabel, humanizeToken } from "../../lib/shopProducts.js";

function ProductQuickPreviewModal({ product, onClose, onAdded }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!product) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, product]);

  if (!product) {
    return null;
  }

  const title = `${humanizeToken(product.design)} ${humanizeToken(product.garment)}`;
  const priceLabel = getPriceLabel(product);

  return (
    <div className="shop-preview-modal" role="dialog" aria-modal="true" aria-label={`Quick preview: ${title}`}>
      <button
        type="button"
        className="shop-preview-modal__backdrop"
        onClick={onClose}
        aria-label="Close quick preview"
      />

      <div className="shop-preview-modal__panel">
        <header className="shop-preview-modal__header">
          <p className="eyebrow">Quick Preview</p>
          <button
            ref={closeButtonRef}
            type="button"
            className="shop-preview-modal__close"
            onClick={onClose}
            aria-label="Close quick preview"
          >
            x
          </button>
        </header>

        <ProductGallery product={product} title={title} className="shop-preview-modal__gallery" />

        <div className="shop-preview-modal__content">
          <h3>{title}</h3>
          <p>{priceLabel}</p>
          <ProductPurchasePanel key={product.key} product={product} onAdded={onAdded} />
        </div>
      </div>
    </div>
  );
}

export default ProductQuickPreviewModal;

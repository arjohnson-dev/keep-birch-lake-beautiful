import { useState } from "react";

function ProductImage({ candidates, alt, className = "" }) {
  const [index, setIndex] = useState(0);

  if (!candidates[index]) {
    return (
      <div
        className={`shop-product-card__image shop-product-card__image--placeholder ${className}`.trim()}
        role="img"
        aria-label={alt}
      >
        Image coming soon
      </div>
    );
  }

  return (
    <img
      className={`shop-product-card__image ${className}`.trim()}
      src={candidates[index]}
      alt={alt}
      loading="lazy"
      onError={() => setIndex((previous) => previous + 1)}
    />
  );
}

export default ProductImage;

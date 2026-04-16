import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ProductImage from "../components/shop/ProductImage.jsx";
import ProductQuickPreviewModal from "../components/shop/ProductQuickPreviewModal.jsx";
import { useCart } from "../context/CartContext.jsx";
import { handleAppLinkClick } from "../lib/navigation.js";
import { getSessionCatalog } from "../lib/shopCatalog.js";
import {
  buildProducts,
  getImageCandidates,
  getPriceLabel,
  groupProducts,
  humanizeToken,
  isDonationProduct,
} from "../lib/shopProducts.js";
import "./ShopView.css";

function getCategoryLabel(category) {
  if (category === "print") {
    return "Artwork";
  }

  return humanizeToken(category);
}

function getGarmentLabel(garment) {
  if (garment === "print") {
    return "Prints";
  }

  const label = humanizeToken(garment);

  if (/s$/i.test(label)) {
    return label;
  }

  if (/[^aeiou]y$/i.test(label)) {
    return `${label.slice(0, -1)}ies`;
  }

  if (/(ch|sh|x|z)$/i.test(label)) {
    return `${label}es`;
  }

  return `${label}s`;
}

const MOBILE_SHOP_MEDIA_QUERY = "(max-width: 640px)";
const LOOP_COPY_COUNT = 5;
const LOOP_CENTER_COPY_INDEX = Math.floor(LOOP_COPY_COUNT / 2);

function ShopProductRail({ products, onQuickPreview }) {
  const railRef = useRef(null);
  const isAdjustingRef = useRef(false);
  const wrapTimeoutRef = useRef(0);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_SHOP_MEDIA_QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_SHOP_MEDIA_QUERY);
    const onChange = (event) => setIsMobile(event.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  const canLoop = isMobile && products.length > 1;
  const visibleProducts = useMemo(() => {
    if (!canLoop) {
      return products.map((product) => ({
        product,
        copyIndex: 0,
        itemIndex: 0,
      }));
    }

    return Array.from({ length: LOOP_COPY_COUNT }, (_, copyIndex) =>
      products.map((product, itemIndex) => ({
        product,
        copyIndex,
        itemIndex,
      })),
    ).flat();
  }, [canLoop, products]);

  const getSequenceWidth = useCallback(() => {
    const rail = railRef.current;
    if (!rail || rail.children.length <= products.length) {
      return 0;
    }

    const first = rail.children[0];
    const secondSequenceFirst = rail.children[products.length];

    if (!first || !secondSequenceFirst) {
      return 0;
    }

    return secondSequenceFirst.offsetLeft - first.offsetLeft;
  }, [products.length]);

  const alignToMiddleSet = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }

    const sequenceWidth = getSequenceWidth();
    if (sequenceWidth > 0) {
      rail.scrollLeft = sequenceWidth * LOOP_CENTER_COPY_INDEX;
    }
  }, [getSequenceWidth]);

  useEffect(() => {
    if (!canLoop) {
      return;
    }

    isAdjustingRef.current = false;
    alignToMiddleSet();
    const frameId = window.requestAnimationFrame(alignToMiddleSet);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(wrapTimeoutRef.current);
    };
  }, [canLoop, alignToMiddleSet]);

  const correctLoopPosition = useCallback(() => {
    if (!canLoop || isAdjustingRef.current) {
      return;
    }

    const rail = railRef.current;
    if (!rail) {
      return;
    }

    const sequenceWidth = getSequenceWidth();
    if (sequenceWidth <= 0) {
      return;
    }

    const minPreferred = sequenceWidth * (LOOP_CENTER_COPY_INDEX - 0.5);
    const maxPreferred = sequenceWidth * (LOOP_CENTER_COPY_INDEX + 0.5);
    let nextScrollLeft = rail.scrollLeft;

    while (nextScrollLeft <= minPreferred) {
      nextScrollLeft += sequenceWidth;
    }

    while (nextScrollLeft >= maxPreferred) {
      nextScrollLeft -= sequenceWidth;
    }

    if (nextScrollLeft === rail.scrollLeft) {
      return;
    }

    isAdjustingRef.current = true;
    rail.scrollLeft = nextScrollLeft;
    window.requestAnimationFrame(() => {
      isAdjustingRef.current = false;
    });
  }, [canLoop, getSequenceWidth]);

  const handleRailScroll = () => {
    if (!canLoop || isAdjustingRef.current) {
      return;
    }

    window.clearTimeout(wrapTimeoutRef.current);
    wrapTimeoutRef.current = window.setTimeout(() => {
      correctLoopPosition();
    }, 90);
  };

  return (
    <div
      ref={railRef}
      className="shop-product-grid"
      onScroll={handleRailScroll}
    >
      {visibleProducts.map(({ product, copyIndex, itemIndex }) => {
        const key = canLoop
          ? `${product.key}-copy-${copyIndex}-item-${itemIndex}`
          : product.key;

        return (
          <article key={key} className="shop-product-card">
            <ProductImage
              candidates={getImageCandidates(product)}
              alt={`${humanizeToken(product.design)} ${humanizeToken(product.garment)}`}
            />

            <div className="shop-product-card__body">
              <h5>{humanizeToken(product.design)}</h5>
              <p className="shop-product-card__price">
                {getPriceLabel(product)}
              </p>
              {!product.inStock ? (
                <p className="shop-product-card__sold-out">
                  SOLD OUT
                </p>
              ) : null}

              <div className="shop-product-card__actions">
                <button
                  type="button"
                  className="shop-product-card__ghost-btn"
                  onClick={() => onQuickPreview(product.key)}
                >
                  Quick preview
                </button>

                <a
                  href={product.slug}
                  className="shop-product-card__ghost-btn"
                  onClick={(event) =>
                    handleAppLinkClick(event, product.slug)
                  }
                >
                  View product
                </a>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ShopView() {
  const { openCart } = useCart();
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [addedMessage, setAddedMessage] = useState("");
  const [previewProductKey, setPreviewProductKey] = useState("");

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const payload = await getSessionCatalog();

        if (active) {
          setCatalog(payload.items.filter((item) => item.active));
          setStatus("ready");
        }
      } catch (error) {
        if (active) {
          setStatus("error");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the catalog. Please try again.",
          );
        }
      }
    };

    loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!addedMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setAddedMessage(""), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [addedMessage]);

  const products = useMemo(() => {
    const allProducts = buildProducts(catalog);
    return allProducts.filter((product) => !isDonationProduct(product));
  }, [catalog]);
  const grouped = useMemo(() => groupProducts(products), [products]);
  const previewProduct = useMemo(
    () => products.find((product) => product.key === previewProductKey) ?? null,
    [previewProductKey, products],
  );

  const query = new URLSearchParams(window.location.search);
  const checkoutCancelled = query.get("checkout") === "cancelled";

  return (
    <section id="shop" className="view shop-view">
      {checkoutCancelled ? (
        <p className="shop-alert" role="status">
          Checkout was canceled. Your cart is still here whenever you are ready.
        </p>
      ) : null}

      {addedMessage ? (
        <p className="shop-alert" role="status">
          {addedMessage}
        </p>
      ) : null}

      {status === "loading" ? <p>Loading catalog...</p> : null}

      {status === "error" ? (
        <div className="shop-error" role="alert">
          <p>{errorMessage || "Catalog could not be loaded."}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {status === "ready"
        ? Object.entries(grouped).map(([category, garments]) => (
            <section
              key={category}
              className="shop-card-section"
              aria-label={getCategoryLabel(category)}
            >
              <h3>{getCategoryLabel(category)}</h3>

              {Object.entries(garments).map(([garment, garmentProducts]) => (
                <div
                  key={`${category}-${garment}`}
                  className="shop-garment-block"
                >
                  <h4>{getGarmentLabel(garment)}</h4>

                  <ShopProductRail
                    products={garmentProducts}
                    onQuickPreview={setPreviewProductKey}
                  />
                </div>
              ))}
            </section>
          ))
        : null}

      <ProductQuickPreviewModal
        product={previewProduct}
        onClose={() => setPreviewProductKey("")}
        onAdded={({ message }) => {
          setAddedMessage(message);
          setPreviewProductKey("");
          openCart();
        }}
      />
    </section>
  );
}

export default ShopView;

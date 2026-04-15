import { useEffect, useMemo, useState } from "react";
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
} from "../lib/shopProducts.js";

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

  const products = useMemo(() => buildProducts(catalog), [catalog]);
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
              aria-label={humanizeToken(category)}
            >
              <h3>{humanizeToken(category)}</h3>

              {Object.entries(garments).map(([garment, garmentProducts]) => (
                <div
                  key={`${category}-${garment}`}
                  className="shop-garment-block"
                >
                  <h4>{humanizeToken(garment)}</h4>

                  <div className="shop-product-grid">
                    {garmentProducts.map((product) => (
                      <article key={product.key} className="shop-product-card">
                        <ProductImage
                          candidates={getImageCandidates(product)}
                          alt={`${humanizeToken(product.design)} ${humanizeToken(product.garment)}`}
                        />

                        <div className="shop-product-card__body">
                          <h5>{humanizeToken(product.design)}</h5>
                          <p className="shop-product-card__price">
                            {getPriceLabel(product)}
                          </p>

                          <div className="shop-product-card__actions">
                            <button
                              type="button"
                              className="shop-product-card__ghost-btn"
                              onClick={() => setPreviewProductKey(product.key)}
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
                    ))}
                  </div>
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

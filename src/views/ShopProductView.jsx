import { useEffect, useMemo, useState } from "react";
import ProductGallery from "../components/shop/ProductGallery.jsx";
import ProductPurchasePanel from "../components/shop/ProductPurchasePanel.jsx";
import { handleAppLinkClick, navigateTo } from "../lib/navigation.js";
import { getSessionCatalog } from "../lib/shopCatalog.js";
import {
  buildProducts,
  getPriceLabel,
  humanizeToken,
} from "../lib/shopProducts.js";

function ShopProductView({ category, garment, design }) {
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [addedMessage, setAddedMessage] = useState("");

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
  const product = useMemo(
    () =>
      products.find(
        (candidate) =>
          candidate.category === category &&
          candidate.garment === garment &&
          candidate.design === design,
      ) ?? null,
    [category, design, garment, products],
  );

  const title = product
    ? `${humanizeToken(product.design)} ${humanizeToken(product.garment)}`
    : "Product";

  return (
    <section className="view shop-view">
      <div className="section-heading">
        <p className="eyebrow">Shop Product</p>
        <h2>{title}</h2>
        <p>
          <a href="/shop" onClick={(event) => handleAppLinkClick(event, "/shop")}>
            Back to shop catalog
          </a>
        </p>
      </div>

      {addedMessage ? (
        <p className="shop-alert" role="status">
          {addedMessage}
        </p>
      ) : null}

      {status === "loading" ? <p>Loading product...</p> : null}

      {status === "error" ? (
        <div className="shop-error" role="alert">
          <p>{errorMessage || "Product could not be loaded."}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {status === "ready" && !product ? (
        <div className="shop-error" role="alert">
          <p>That product could not be found.</p>
          <button type="button" onClick={(event) => handleAppLinkClick(event, "/shop")}>
            Back to shop
          </button>
        </div>
      ) : null}

      {status === "ready" && product ? (
        <article className="shop-product-detail">
          <ProductGallery
            product={product}
            title={`${humanizeToken(product.design)} ${humanizeToken(product.garment)}`}
            className="shop-product-detail__gallery"
          />

          <div className="shop-product-detail__body">
            <p className="eyebrow">{humanizeToken(product.category)}</p>
            <h3>{title}</h3>
            <p className="shop-product-card__price">{getPriceLabel(product)}</p>
            <ProductPurchasePanel
              key={product.key}
              product={product}
              onAdded={({ message }) => {
                setAddedMessage(message);
                navigateTo("/shop/cart");
              }}
            />
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default ShopProductView;

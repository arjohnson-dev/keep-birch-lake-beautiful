import { useEffect, useMemo, useState } from "react";
import { BiCollapseAlt, BiExpandAlt } from "react-icons/bi";
import { getDesignImageCandidates, getImageCandidates } from "../../lib/shopProducts.js";

function imageExists(src) {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

async function resolveCandidate(candidates) {
  const checks = await Promise.all(
    candidates.map(async (src) => ({ src, exists: await imageExists(src) })),
  );

  return checks.find((item) => item.exists)?.src ?? null;
}

function ProductGallery({ product, title, className = "" }) {
  const [slides, setSlides] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const candidateSets = useMemo(
    () =>
      product.category === "print"
        ? [getImageCandidates(product)]
        : [getImageCandidates(product), getDesignImageCandidates(product)],
    [product],
  );

  const candidateSignature = candidateSets.flat().join("|");

  useEffect(() => {
    let active = true;

    const loadSlides = async () => {
      const resolved = await Promise.all(candidateSets.map((set) => resolveCandidate(set)));
      const unique = [...new Set(resolved.filter(Boolean))].map((src, index) => ({
        src,
        alt: index === 0 ? `${title} main image` : `${title} design image`,
      }));

      if (!active) {
        return;
      }

      setSlides(unique);
      setActiveIndex(0);
    };

    loadSlides();
    return () => {
      active = false;
    };
  }, [candidateSets, candidateSignature, title]);

  useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }

      if (event.key === "ArrowRight" && slides.length > 1) {
        setActiveIndex((current) => (current + 1) % slides.length);
      }

      if (event.key === "ArrowLeft" && slides.length > 1) {
        setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
      }
    };

    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [isExpanded, slides.length]);

  const hasSlides = slides.length > 0;
  const hasMultiple = slides.length > 1;

  const goPrevious = () => {
    if (!hasMultiple) {
      return;
    }

    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    if (!hasMultiple) {
      return;
    }

    setActiveIndex((current) => (current + 1) % slides.length);
  };

  const renderGallery = ({ expanded }) => (
    <div className={`shop-gallery${expanded ? " shop-gallery--expanded" : ""} ${className}`.trim()}>
      {hasSlides ? (
        <img
          className="shop-gallery__image"
          src={slides[activeIndex].src}
          alt={slides[activeIndex].alt}
          loading="lazy"
        />
      ) : (
        <div className="shop-gallery__image shop-product-card__image--placeholder" role="img" aria-label={title}>
          Image coming soon
        </div>
      )}

      {hasMultiple ? (
        <>
          <button type="button" className="shop-gallery__nav shop-gallery__nav--prev" onClick={goPrevious} aria-label="Previous image">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" className="shop-gallery__nav shop-gallery__nav--next" onClick={goNext} aria-label="Next image">
            <span aria-hidden="true">›</span>
          </button>
          <p className="shop-gallery__counter" aria-live="polite">
            {activeIndex + 1}/{slides.length}
          </p>
        </>
      ) : null}

      <button
        type="button"
        className="shop-gallery__expand"
        onClick={() => setIsExpanded((current) => !current)}
        aria-label={expanded ? "Collapse gallery" : "Expand gallery"}
      >
        {expanded ? <BiCollapseAlt aria-hidden="true" /> : <BiExpandAlt aria-hidden="true" />}
      </button>
    </div>
  );

  return (
    <>
      {renderGallery({ expanded: false })}

      {isExpanded ? (
        <div className="shop-gallery-lightbox" role="dialog" aria-modal="true" aria-label={`${title} expanded gallery`}>
          <button
            type="button"
            className="shop-gallery-lightbox__backdrop"
            onClick={() => setIsExpanded(false)}
            aria-label="Close expanded gallery"
          />

          <div className="shop-gallery-lightbox__panel">{renderGallery({ expanded: true })}</div>
        </div>
      ) : null}
    </>
  );
}

export default ProductGallery;

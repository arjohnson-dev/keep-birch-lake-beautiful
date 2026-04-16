import { useEffect } from "react";
import { BiCollapseAlt } from "react-icons/bi";
import "./ExpandableGalleryLightbox.css";

function ExpandableGalleryLightbox({
  slides,
  activeIndex,
  onPrevious,
  onNext,
  onClose,
  ariaLabel,
}) {
  const hasSlides = slides.length > 0;
  const hasMultiple = slides.length > 1;

  useEffect(() => {
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowRight" && hasMultiple) {
        onNext();
      }

      if (event.key === "ArrowLeft" && hasMultiple) {
        onPrevious();
      }
    };

    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [hasMultiple, onClose, onNext, onPrevious]);

  return (
    <div
      className="expandable-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="expandable-gallery-lightbox__backdrop"
        onClick={onClose}
        aria-label="Close expanded gallery"
      />

      <div className="expandable-gallery-lightbox__panel">
        <div className="expandable-gallery">
          {hasSlides ? (
            <img
              className="expandable-gallery__image"
              src={slides[activeIndex].src}
              alt={slides[activeIndex].alt}
            />
          ) : (
            <div
              className="expandable-gallery__image expandable-gallery__placeholder"
              role="img"
              aria-label="Image coming soon"
            >
              Image coming soon
            </div>
          )}

          {hasMultiple ? (
            <>
              <button
                type="button"
                className="expandable-gallery__nav expandable-gallery__nav--prev"
                onClick={onPrevious}
                aria-label="Previous image"
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                type="button"
                className="expandable-gallery__nav expandable-gallery__nav--next"
                onClick={onNext}
                aria-label="Next image"
              >
                <span aria-hidden="true">›</span>
              </button>
              <p className="expandable-gallery__counter" aria-live="polite">
                {activeIndex + 1}/{slides.length}
              </p>
            </>
          ) : null}

          <button
            type="button"
            className="expandable-gallery__collapse"
            onClick={onClose}
            aria-label="Collapse gallery"
          >
            <BiCollapseAlt aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExpandableGalleryLightbox;

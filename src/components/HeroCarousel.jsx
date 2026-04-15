import { useEffect, useMemo, useState } from "react";
import { getSessionCatalog } from "../lib/shopCatalog.js";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MAX_SLIDES = 8;

function toTitle(value) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace("Tshirt", "T-Shirt");
}

function buildImageStems(item) {
  if (item.category === "print") {
    return [`${item.design}_print`, item.design];
  }

  return [`${item.garment}_${item.design}`];
}

function shuffle(values) {
  const next = [...values];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function imageExists(src) {
  return new Promise((resolve) => {
    const image = new window.Image();

    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

function HeroCarousel() {
  const [slides, setSlides] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    let active = true;

    const loadSlides = async () => {
      try {
        const payload = await getSessionCatalog();

        const stems = [];
        const seen = new Set();

        for (const item of payload.items) {
          if (!item?.active) {
            continue;
          }

          for (const stem of buildImageStems(item)) {
            if (!seen.has(stem)) {
              seen.add(stem);
              stems.push(stem);
            }
          }
        }

        const resolvedSlides = [];
        for (const stem of shuffle(stems)) {
          let matchedSrc = null;

          for (const extension of IMAGE_EXTENSIONS) {
            const candidate = `/shop/${stem}.${extension}`;
            // Verify file existence so the hero only uses real images from /public/shop.
            const exists = await imageExists(candidate);
            if (exists) {
              matchedSrc = candidate;
              break;
            }
          }

          if (matchedSrc) {
            resolvedSlides.push({
              src: matchedSrc,
              alt: `${toTitle(stem)} artwork`,
            });
          }

          if (resolvedSlides.length >= MAX_SLIDES) {
            break;
          }
        }

        if (active && resolvedSlides.length > 0) {
          setSlides(resolvedSlides);
          setActiveSlide(0);
        }
      } catch {
        // Keep hero functional even if the catalog API is unavailable.
      }
    };

    loadSlides();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  const visibleSlides = useMemo(() => {
    if (slides.length > 0) {
      return slides;
    }

    return [
      {
        src: "/shop/seagull.jpg",
        alt: "Featured Birch Lake artwork",
      },
    ];
  }, [slides]);

  return (
    <div className="hero__carousel" aria-label="Featured Birch Lake artwork">
      <div className="hero__slides">
        {visibleSlides.map((slide, index) => (
          <figure
            key={slide.src}
            className={`hero__slide${index === activeSlide ? " is-active" : ""}`}
            aria-hidden={index !== activeSlide}
          >
            <img src={slide.src} alt={slide.alt} />
          </figure>
        ))}
      </div>
    </div>
  );
}

export default HeroCarousel;

import { useEffect, useMemo, useState } from "react";

const MAX_SLIDES = 8;
const SHOP_IMAGE_FILENAMES = [
  "crewneck_seagull.jpg",
  "crewneck_trout.jpg",
  "crewneck_turtle.jpg",
  "hooded_seagull.jpg",
  "hooded_trout.jpg",
  "hooded_turtle.jpg",
  "seagull_print.jpg",
  "seagull.jpg",
  "trout_print.jpg",
  "trout.jpg",
  "tshirt_seagull.jpg",
  "tshirt_trout.jpg",
  "tshirt_turtle.jpg",
  "turtle_print.jpeg",
  "turtle.jpg",
];

function toTitle(value) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace("Tshirt", "T-Shirt");
}

function shuffle(values) {
  const next = [...values];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function HeroCarousel() {
  const slides = useMemo(
    () =>
      shuffle(SHOP_IMAGE_FILENAMES)
        .slice(0, MAX_SLIDES)
        .map((filename) => {
          const stem = filename.replace(/\.[^.]+$/, "");
          return {
            src: `/shop/${filename}`,
            alt: `${toTitle(stem)} artwork`,
          };
        }),
    [],
  );
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  const normalizedActiveSlide = activeSlide % slides.length;

  return (
    <div className="hero__carousel" aria-label="Featured Birch Lake artwork">
      <div className="hero__slides">
        {slides.map((slide, index) => (
          <figure
            key={slide.src}
            className={`hero__slide${index === normalizedActiveSlide ? " is-active" : ""}`}
            aria-hidden={index !== normalizedActiveSlide}
          >
            <img src={slide.src} alt={slide.alt} />
          </figure>
        ))}
      </div>
    </div>
  );
}

export default HeroCarousel;

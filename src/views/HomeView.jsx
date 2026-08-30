import { useEffect, useState } from "react";
import { MdOutlineWaterDrop } from "react-icons/md";
import HeroCarousel from "../components/HeroCarousel.jsx";
import InstagramFeed from "../components/InstagramFeed.jsx";
import { handleAppLinkClick } from "../lib/navigation.js";
import { redirectToCheckout } from "../lib/checkout.js";
import "./HomeView.css";

const DONATION_LOOKUP_KEY = "donation";
const COACH_DOBA_IMAGES = Object.keys(
  import.meta.glob("/public/coach-bill-doba/*.{jpg,jpeg,png,webp,avif}", {
    eager: true,
    query: "?url",
    import: "default",
  }),
)
  .sort((firstPath, secondPath) =>
    firstPath.localeCompare(secondPath, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  )
  .map((path) => ({
    src: path.replace(/^\/public/, ""),
    alt: "Coach Bill Doba at Birch Lake",
  }));

function CoachDobaCarousel({ className }) {
  const [slides, setSlides] = useState(COACH_DOBA_IMAGES);
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

  const handleSlideError = (src) => {
    setSlides((currentSlides) =>
      currentSlides.filter((slide) => slide.src !== src),
    );
    setActiveSlide(0);
  };

  return (
    <div className={className} aria-label="Coach Bill Doba photos">
      {slides.map((slide, index) => (
        <img
          key={slide.src}
          className={`memorial-hero__slide${index === activeSlide ? " is-active" : ""}`}
          src={slide.src}
          alt={slide.alt}
          aria-hidden={index !== activeSlide}
          decoding="async"
          loading="eager"
          onError={() => handleSlideError(slide.src)}
        />
      ))}
    </div>
  );
}

function HomeView() {
  const [isStartingDonationCheckout, setIsStartingDonationCheckout] = useState(false);
  const [donationError, setDonationError] = useState("");

  const handleDonateClick = async () => {
    if (isStartingDonationCheckout) {
      return;
    }

    setDonationError("");
    setIsStartingDonationCheckout(true);

    try {
      await redirectToCheckout([{ lookupKey: DONATION_LOOKUP_KEY, quantity: 1 }]);
    } catch (error) {
      setDonationError(
        error instanceof Error
          ? error.message
          : "Could not start donation checkout. Please try again.",
      );
      setIsStartingDonationCheckout(false);
    }
  };

  return (
    <section id="home" className="view view--home">
      <div className="memorial-hero">
        <CoachDobaCarousel className="memorial-hero__desktop-carousel" />

        <div className="memorial-hero__copy">
          <p className="memorial-hero__eyebrow">In Memory Of</p>
          <h1>
            <span>Coach</span>
            <span>"Bill" Doba</span>
          </h1>
          <CoachDobaCarousel className="memorial-hero__mobile-carousel" />
          <p className="memorial-hero__lead">
            100% of all donations will go toward water quality at Birch Lake in
            memory of Coach Doba.
          </p>

          <button
            type="button"
            className="hero__cta memorial-hero__donate"
            onClick={handleDonateClick}
            disabled={isStartingDonationCheckout}
          >
            {isStartingDonationCheckout ? "Redirecting..." : "Donate Now"}
          </button>

          <div className="memorial-hero__fund-note">
            <span className="memorial-hero__fund-mark" aria-hidden="true">
              <MdOutlineWaterDrop />
            </span>
            <p>
              Every donation goes straight to the{" "}
              <strong>Birch Lake Water Quality Fund.</strong>
            </p>
          </div>

          {donationError ? (
            <p className="hero__donation-error" role="alert">
              {donationError}
            </p>
          ) : null}

          <a
            className="memorial-hero__shop-link"
            href="/shop"
            onClick={(event) => handleAppLinkClick(event, "/shop")}
          >
            Shop Now
          </a>
        </div>
      </div>

      <section className="coach-message" aria-labelledby="coach-message-heading">
        <h2 id="coach-message-heading">A Note From Phyllis</h2>
        <div className="coach-message__copy">
          <p>
            I am extremely touched and honored that the Doba Family has chosen
            in lieu of flowers, to have Coach&apos;s friends and loved ones make a
            donation in his memory through my website.
          </p>
          <p>
            Every donation from this day forward will be made in Coach&apos;s
            memory and will go straight toward Birch Lake water quality, keeping
            Birch Lake Beautiful for the many generations to come.
          </p>
          <p>
            Coach donated from his heart, and he told me when I started my small
            business to, &quot;go change the world.&quot; I will, for him and for
            all those that love our beautiful lake. I will miss my friend
            dearly. The person who gave me incredible life advice and was
            extremely real, but we will meet again some day.
          </p>
          <p>
            Thank you from the bottom of my heart. Let&apos;s celebrate this
            incredible life lived. We love you Coach! You are the man!
          </p>
        </div>
      </section>

      <div className="thank-you-hero">
        <div className="thank-you-hero__copy">
          <h2>Thank You!</h2>
          <p>
            Thanks to you, we were able to donate $1600 to the Birch Lake Water
            Quality Fund in 2025.
          </p>
          <p>
            Twenty percent of all proceeds continue to go directly to that same
            fund.
          </p>
          <a
            className="hero__cta thank-you-hero__cta"
            href="/shop"
            onClick={(event) => handleAppLinkClick(event, "/shop")}
          >
            Shop Now
          </a>
        </div>

        <HeroCarousel />
      </div>

      <InstagramFeed />
    </section>
  );
}

export default HomeView;

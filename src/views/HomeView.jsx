import { useState } from "react";
import { MdOutlineWaterDrop } from "react-icons/md";
import HeroCarousel from "../components/HeroCarousel.jsx";
import InstagramFeed from "../components/InstagramFeed.jsx";
import { handleAppLinkClick } from "../lib/navigation.js";
import { redirectToCheckout } from "../lib/checkout.js";
import "./HomeView.css";

const DONATION_LOOKUP_KEY = "donation";

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
        <div className="memorial-hero__copy">
          <p className="memorial-hero__eyebrow">In Memory Of</p>
          <h1>
            <span>Coach</span>
            <span>"Bill" Doba</span>
          </h1>
          <div className="memorial-hero__mobile-photo-wrap">
            <img
              className="memorial-hero__mobile-photo"
              src="/coach-bill-doba.jpg"
              alt="Coach Bill Doba at Birch Lake"
            />
          </div>
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

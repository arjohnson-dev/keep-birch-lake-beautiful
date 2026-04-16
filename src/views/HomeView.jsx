import { useState } from "react";
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
      <div className="hero">
        <div className="hero__copy">
          <h1>Thank You!</h1>
          <p>
            Thanks to you, we were able to donate $1600 to the Birch Lake Water
            Quality Fund in 2025.
          </p>
          <p>
            Twenty percent of all proceeds continue to go directly to that same
            fund.
          </p>
          <div className="hero__cta-group">
            <a
              className="hero__cta hero__cta--copy"
              href="/shop"
              onClick={(event) => handleAppLinkClick(event, "/shop")}
            >
              Shop now
            </a>

            <button
              type="button"
              className="hero__cta hero__cta--copy"
              onClick={handleDonateClick}
              disabled={isStartingDonationCheckout}
            >
              {isStartingDonationCheckout ? "Redirecting..." : "Donate"}
            </button>
          </div>
          {donationError ? (
            <p className="hero__donation-error" role="alert">
              {donationError}
            </p>
          ) : null}
        </div>

        <HeroCarousel />
      </div>

      <InstagramFeed />
    </section>
  );
}

export default HomeView;

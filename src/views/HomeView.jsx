import HeroCarousel from "../components/HeroCarousel.jsx";
import InstagramFeed from "../components/InstagramFeed.jsx";
import { handleAppLinkClick } from "../lib/navigation.js";
import "./HomeView.css";

function HomeView() {
  return (
    <section id="home" className="view view--home">
      <div className="thank-you-hero">
        <div className="thank-you-hero__copy">
          <h2>Thank You!</h2>
          <p>
            Thanks to you, we were able to donate $3500 to the Birch Lake Water
            Quality Fund in 2026 and send one camper to Camp Tannadoonah with
            an $800 campership in the summer of 2026.
          </p>
          <p>
            Twenty percent of all proceeds continue to go directly to that same
            fund.
          </p>
          <img
            className="thank-you-hero__camp-photo"
            src="/shop/camp-t-2026.jpg"
            alt="Camp Tannadoonah camper in 2026"
          />
        </div>

        <HeroCarousel />

        <a
          className="hero__cta thank-you-hero__cta"
          href="/shop"
          onClick={(event) => handleAppLinkClick(event, "/shop")}
        >
          Shop Now
        </a>
      </div>

      <InstagramFeed />
    </section>
  );
}

export default HomeView;

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

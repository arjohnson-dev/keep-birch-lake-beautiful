import HeroCarousel from "../components/HeroCarousel.jsx";
import InstagramFeed from "../components/InstagramFeed.jsx";
import { handleAppLinkClick } from "../lib/navigation.js";

function HomeView() {
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
          <a
            className="hero__cta hero__cta--copy"
            href="/shop"
            onClick={(event) => handleAppLinkClick(event, "/shop")}
          >
            Shop now
          </a>
        </div>

        <HeroCarousel />
      </div>

      <InstagramFeed />
    </section>
  );
}

export default HomeView;

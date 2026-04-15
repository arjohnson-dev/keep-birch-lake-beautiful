import HeroCarousel from '../components/HeroCarousel.jsx'

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
          <a className="hero__cta hero__cta--copy" href="#shop">
            Shop now
          </a>
        </div>

        <HeroCarousel />
      </div>
    </section>
  )
}

export default HomeView

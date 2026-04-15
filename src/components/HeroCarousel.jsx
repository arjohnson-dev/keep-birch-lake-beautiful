import { useEffect, useState } from 'react'

const slides = [
  {
    src: '/crewneck-turtle.png',
    alt: 'Crewneck featuring a turtle graphic',
  },
  {
    src: '/hoodie-trout.png',
    alt: 'Hoodie featuring a trout graphic',
  },
  {
    src: '/print-seagull.png',
    alt: 'Seagull art print',
  },
  {
    src: '/print-trout.png',
    alt: 'Trout art print',
  },
  {
    src: '/print-tutrle.png',
    alt: 'Turtle art print',
  },
]

function HeroCarousel() {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length)
    }, 4500)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="hero__carousel" aria-label="Featured Birch Lake artwork">
      <div className="hero__slides">
        {slides.map((slide, index) => (
          <figure
            key={slide.src}
            className={`hero__slide${index === activeSlide ? ' is-active' : ''}`}
            aria-hidden={index !== activeSlide}
          >
            <img src={slide.src} alt={slide.alt} />
          </figure>
        ))}
      </div>
    </div>
  )
}

export default HeroCarousel

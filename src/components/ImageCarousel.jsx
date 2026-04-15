import { useEffect, useState } from 'react'

function ImageCarousel({ images, title, className = '' }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length)
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [images.length])

  return (
    <div className={`image-carousel ${className}`.trim()} aria-label={title}>
      <div className="image-carousel__slides">
        {images.map((image, index) => (
          <figure
            key={image.src}
            className={`image-carousel__slide${index === activeIndex ? ' is-active' : ''}`}
            aria-hidden={index !== activeIndex}
          >
            <img src={image.src} alt={image.alt} />
          </figure>
        ))}
      </div>
    </div>
  )
}

export default ImageCarousel

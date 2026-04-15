const products = [
  {
    name: 'Crewneck Turtle',
    image: '/crewneck-turtle.png',
    description: 'A soft layer for cool mornings on the dock.',
  },
  {
    name: 'Hoodie Trout',
    image: '/hoodie-trout.png',
    description: 'A shoreline staple with a graphic drawn from the lake.',
  },
  {
    name: 'Seagull Print',
    image: '/print-seagull.png',
    description: 'A framed reminder of the birds that mark the season.',
  },
]

function ShopView() {
  return (
    <section id="shop" className="view">
      <div className="section-heading">
        <p className="eyebrow">Shop</p>
        <h2>Featured pieces from the first collection.</h2>
      </div>

      <div className="shop-grid">
        {products.map((product) => (
          <article key={product.name} className="product-card">
            <div className="product-card__media">
              <img src={product.image} alt={product.name} />
            </div>
            <div className="product-card__body">
              <h3>{product.name}</h3>
              <p>{product.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ShopView

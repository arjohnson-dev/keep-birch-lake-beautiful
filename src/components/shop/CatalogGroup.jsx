function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function CatalogGroup({ title, items }) {
  return (
    <section className="catalog-group" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.lookupKey}>
            <span>
              {item.category === "print"
                ? `${item.design} print`
                : `${item.design} ${item.garment} ${item.size}`}
            </span>
            <strong>{formatMoney(item.amount, item.currency)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CatalogGroup;

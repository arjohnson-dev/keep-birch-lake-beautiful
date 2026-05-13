function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getItemLabel(item) {
  if (item.category === "print") {
    return `${item.design} print`;
  }

  return [item.design, item.garment, item.size].filter(Boolean).join(" ");
}

function CatalogGroup({ title, items }) {
  return (
    <section className="catalog-group" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.lookupKey}>
            <span>{getItemLabel(item)}</span>
            <strong>{formatMoney(item.amount, item.currency)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CatalogGroup;

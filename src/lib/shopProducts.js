const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function humanizeToken(token) {
  const labelOverrides = {
    tshirt: "T-Shirt",
    hooded: "Hoodies",
  };

  if (labelOverrides[token]) {
    return labelOverrides[token];
  }

  return token
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getDefaultSize(sizes) {
  if (sizes.includes("m")) {
    return "m";
  }

  return sizes[0] ?? "";
}

function getImageCandidatesForStem(stem) {
  return IMAGE_EXTENSIONS.map((extension) => `/shop/${stem}.${extension}`);
}

function getImageCandidates({ garment, design, category }) {
  if (category === "print") {
    const stems = [`${design}_print`, design];
    return stems.flatMap((stem) => getImageCandidatesForStem(stem));
  }

  const stem = `${garment}_${design}`;
  return getImageCandidatesForStem(stem);
}

function getDesignImageCandidates({ design }) {
  return getImageCandidatesForStem(design);
}

function buildProducts(items) {
  const byKey = new Map();

  for (const item of items) {
    const key = `${item.category}__${item.garment}__${item.design}`;
    const existing = byKey.get(key) ?? {
      key,
      category: item.category,
      garment: item.garment,
      design: item.design,
      name: item.name,
      currency: item.currency,
      sizeItems: {},
      sizes: [],
      baseItem: item,
      minAmount: item.amount,
      maxAmount: item.amount,
    };

    if (item.size) {
      existing.sizeItems[item.size] = item;
      existing.sizes.push(item.size);
    } else {
      existing.baseItem = item;
    }

    existing.minAmount = Math.min(existing.minAmount, item.amount);
    existing.maxAmount = Math.max(existing.maxAmount, item.amount);

    byKey.set(key, existing);
  }

  return [...byKey.values()]
    .map((product) => {
      const uniqueSizes = [...new Set(product.sizes)].sort((left, right) => left.localeCompare(right));
      const defaultSize = getDefaultSize(uniqueSizes);
      const baseItem = uniqueSizes.length > 0
        ? product.sizeItems[defaultSize] ?? product.sizeItems[uniqueSizes[0]]
        : product.baseItem;

      return {
        ...product,
        sizes: uniqueSizes,
        defaultSize,
        baseItem,
        slug: `/shop/${product.category}/${product.garment}/${product.design}`,
      };
    })
    .sort((left, right) => {
      const categoryDelta = left.category.localeCompare(right.category);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }

      const garmentDelta = left.garment.localeCompare(right.garment);
      if (garmentDelta !== 0) {
        return garmentDelta;
      }

      return left.design.localeCompare(right.design);
    });
}

function groupProducts(products) {
  const grouped = {};

  for (const product of products) {
    if (!grouped[product.category]) {
      grouped[product.category] = {};
    }

    if (!grouped[product.category][product.garment]) {
      grouped[product.category][product.garment] = [];
    }

    grouped[product.category][product.garment].push(product);
  }

  for (const category of Object.keys(grouped)) {
    for (const garment of Object.keys(grouped[category])) {
      grouped[category][garment].sort((left, right) => left.design.localeCompare(right.design));
    }
  }

  return grouped;
}

function getPriceLabel(product) {
  if (product.minAmount === product.maxAmount) {
    return formatMoney(product.minAmount, product.currency);
  }

  return `${formatMoney(product.minAmount, product.currency)} - ${formatMoney(product.maxAmount, product.currency)}`;
}

export {
  buildProducts,
  formatMoney,
  getDesignImageCandidates,
  getImageCandidates,
  getPriceLabel,
  groupProducts,
  humanizeToken,
};

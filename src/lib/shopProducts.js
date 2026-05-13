const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const SIZE_ORDER = ["s", "m", "l", "xl", "xxl", "xxxl"];
const SIZE_RANK = new Map(SIZE_ORDER.map((size, index) => [size, index]));
const CATEGORY_ORDER = ["home_goods", "apparel", "print", "donation"];
const CATEGORY_RANK = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
const DONATION_LOOKUP_KEY = "donation";
const DONATION_PRODUCT_ID = "prod_ULYsjKMKX2RRbT";

function humanizeToken(token) {
  const labelOverrides = {
    home_goods: "Home Goods",
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

function getDefaultSize(sizes, sizeItems = {}) {
  const inStockSizes = sizes.filter((size) => Boolean(sizeItems[size]?.inStock));
  const candidates = inStockSizes.length > 0 ? inStockSizes : sizes;

  if (candidates.includes("m")) {
    return "m";
  }

  return candidates[0] ?? "";
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

function compareCategories(left, right) {
  const leftRank = CATEGORY_RANK.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = CATEGORY_RANK.get(right) ?? Number.MAX_SAFE_INTEGER;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.localeCompare(right);
}

function getSecondaryImageCandidates(product) {
  if (product.category === "home_goods" && product.garment === "towel") {
    return getImageCandidatesForStem("towels");
  }

  return getDesignImageCandidates(product);
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
      description: item.description ?? "",
      currency: item.currency,
      sizeItems: {},
      sizes: [],
        baseItem: item,
        minAmount: item.amount,
        maxAmount: item.amount,
        inStock: false,
      };

    if (item.size) {
      existing.sizeItems[item.size] = item;
      existing.sizes.push(item.size);
    } else {
      existing.baseItem = item;
    }

    existing.minAmount = Math.min(existing.minAmount, item.amount);
    existing.maxAmount = Math.max(existing.maxAmount, item.amount);
    existing.inStock = existing.inStock || Boolean(item.inStock);
    if (!existing.description && item.description) {
      existing.description = item.description;
    }

    byKey.set(key, existing);
  }

  return [...byKey.values()]
    .map((product) => {
      const uniqueSizes = [...new Set(product.sizes)].sort((left, right) => left.localeCompare(right));
      const orderedSizes = uniqueSizes.sort((left, right) => {
        const leftRank = SIZE_RANK.get(left) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = SIZE_RANK.get(right) ?? Number.MAX_SAFE_INTEGER;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return left.localeCompare(right);
      });
      const defaultSize = getDefaultSize(orderedSizes, product.sizeItems);
      const baseItem = orderedSizes.length > 0
        ? product.sizeItems[defaultSize] ?? product.sizeItems[orderedSizes[0]]
        : product.baseItem;
      const inStock = orderedSizes.length > 0
        ? orderedSizes.some((size) => Boolean(product.sizeItems[size]?.inStock))
        : Boolean(baseItem?.inStock);

      return {
        ...product,
        sizes: orderedSizes,
        defaultSize,
        baseItem,
        inStock,
        slug: `/shop/${product.category}/${product.garment}/${product.design}`,
      };
    })
    .sort((left, right) => {
      const categoryDelta = compareCategories(left.category, right.category);
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

function isDonationProduct(entry) {
  return (
    entry?.lookupKey === DONATION_LOOKUP_KEY ||
    entry?.baseItem?.lookupKey === DONATION_LOOKUP_KEY ||
    entry?.productId === DONATION_PRODUCT_ID ||
    entry?.baseItem?.productId === DONATION_PRODUCT_ID ||
    entry?.key === "donation__donation__donation"
  );
}

export {
  buildProducts,
  formatMoney,
  getDesignImageCandidates,
  getImageCandidates,
  getSecondaryImageCandidates,
  getPriceLabel,
  groupProducts,
  humanizeToken,
  isDonationProduct,
};

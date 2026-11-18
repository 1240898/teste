/** Price returned by the API ({ amount: "9.50", currency: "EUR" }). */
export function formatPrice(price, locale) {
  if (!price) return '';
  const amount = Number(price.amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: price.currency,
    }).format(amount);
  } catch {
    return `${price.amount} ${price.currency}`;
  }
}

/** Lowest price among the available sizes of a pizza (null if none). */
export function lowestSizePrice(product) {
  const prices = (product.pizza?.sizes ?? [])
    .filter((size) => size.available)
    .map((size) => size.price);
  return prices.reduce(
    (lowest, price) =>
      lowest === null || Number(price.amount) < Number(lowest.amount)
        ? price
        : lowest,
    null,
  );
}
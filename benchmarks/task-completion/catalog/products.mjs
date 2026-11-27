const products = [
  { sku: "p01", name: "Filter", price: 18 },
  { sku: "p02", name: "Carafe", price: 24 },
];

export function findProduct(sku) {
  return products.find((product) => product.sku === sku);
}

import { findProduct } from "./products.mjs";

export function productLabel(sku) {
  const product = findProduct(sku);
  return product ? `${product.name} ($${product.price})` : "Product unavailable";
}

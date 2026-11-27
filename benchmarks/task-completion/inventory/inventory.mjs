export class Inventory {
  #stock;
  #unavailable = new Set();

  constructor(stock) {
    this.#stock = new Map(Object.entries(stock));
  }

  setUnavailable(bin, unavailable = true) {
    if (unavailable) this.#unavailable.add(bin);
    else this.#unavailable.delete(bin);
  }

  async read(bin) {
    return this.#stock.get(bin) ?? 0;
  }

  async write(bin, amount) {
    if (this.#unavailable.has(bin)) throw new Error(`bin unavailable: ${bin}`);
    this.#stock.set(bin, amount);
  }
}

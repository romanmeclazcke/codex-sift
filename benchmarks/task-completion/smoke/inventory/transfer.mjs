const pending = new WeakMap();

export async function move(inventory, from, to, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError("invalid amount");
  if (from === to) return;

  const transfer = (pending.get(inventory) ?? Promise.resolve()).then(async () => {
    const available = await inventory.read(from);
    if (available < amount) throw new Error("insufficient stock");
    const destination = await inventory.read(to);
    await inventory.write(from, available - amount);
    try {
      await inventory.write(to, destination + amount);
    } catch (error) {
      await inventory.write(from, available);
      throw error;
    }
  });
  pending.set(inventory, transfer.catch(() => {}));
  await transfer;
}

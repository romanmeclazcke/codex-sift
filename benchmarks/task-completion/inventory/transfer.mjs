export async function move(inventory, from, to, amount) {
  const available = await inventory.read(from);
  if (available < amount) throw new Error("insufficient stock");
  const destination = await inventory.read(to);
  await inventory.write(from, available - amount);
  await inventory.write(to, destination + amount);
}

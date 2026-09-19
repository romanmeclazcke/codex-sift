import { loadPolicy } from "./policy.js";
import { readLog } from "./log.js";

export function runReport(): number {
  const policy = loadPolicy();
  const rows = readLog();
  if (!rows.length) {
    process.stdout.write("No decisions logged yet.\n");
    return 1;
  }
  const counts = new Map<string, number>();
  let flagship = 0;
  let actual = 0;
  const flagshipName = policy.lanes.forge?.model || "gpt-5.6-sol";
  const flagshipPrice = policy.prices_usd_per_1m[flagshipName] || 0;
  for (const row of rows) {
    counts.set(row.lane, (counts.get(row.lane) || 0) + 1);
    const tokens = Math.max(800, row.prompt_chars) / 4;
    const millions = tokens / 1_000_000;
    flagship += millions * flagshipPrice;
    actual += millions * (policy.prices_usd_per_1m[row.model] || 0);
  }
  const mix = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lane, n]) => `${lane}: ${n} (${((n / rows.length) * 100).toFixed(0)}%)`)
    .join(", ");
  const saved = Math.max(0, flagship - actual);
  const lines = [
    `turns: ${rows.length}`,
    `mix: ${mix}`,
    `degraded: ${rows.filter((r) => r.degraded).length}`,
    `est. vs always-${flagshipName}: $${flagship.toFixed(4)} -> $${actual.toFixed(4)} (save $${saved.toFixed(4)})`,
    `note: estimate uses prompt size only; Codex output tokens are not visible to Sift.`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

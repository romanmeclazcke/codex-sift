const packageName = "codex-sift";
const terms = ["codex-sift", "codex model routing", "codex cli model router", "codex cost optimization", "codex token usage", "codex cli"];

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.json();
}

const [week, month, ...positions] = await Promise.all([
  ...["last-week", "last-month"].map((period) =>
    getJson(`https://api.npmjs.org/downloads/point/${period}/${packageName}`)
  ),
  ...terms.map(async (term) => {
    const query = new URLSearchParams({ text: term, size: "50" });
    const { objects } = await getJson(`https://registry.npmjs.org/-/v1/search?${query}`);
    const rank = objects.findIndex((result) => result.package.name === packageName) + 1;
    return { term, rank: rank || ">50" };
  }),
]);

console.log(`# Codex Sift discovery · ${new Date().toISOString().slice(0, 10)}`);
console.log(`\n- 7-day downloads: ${week.downloads} (${week.start} to ${week.end})`);
console.log(`- 30-day downloads: ${month.downloads} (${month.start} to ${month.end})`);
console.log("\n| Registry query | Position |\n| --- | --- |");
for (const { term, rank } of positions) console.log(`| ${term} | ${rank} |`);

export type CatalogChoice = {
  slug: string;
  display_name: string;
  description: string;
};

export function listVisibleModels(catalog: { models: Array<Record<string, unknown>> }): CatalogChoice[] {
  const models = Array.isArray(catalog.models) ? catalog.models : [];
  return models
    .filter((m) => m.visibility === "list" && typeof m.slug === "string" && m.slug !== "sift")
    .sort((a, b) => Number(a.priority ?? 99) - Number(b.priority ?? 99))
    .map((m) => ({
      slug: String(m.slug),
      display_name: String(m.display_name || m.slug),
      description: String(m.description || ""),
    }));
}

export function formatModelMenu(models: CatalogChoice[]): string {
  return models
    .map((m, i) => {
      const n = String(i + 1).padStart(2, " ");
      const desc = m.description ? `  ${m.description}` : "";
      return `${n}. ${m.display_name}  (${m.slug})${desc}`;
    })
    .join("\n");
}

export function defaultLaneIndexes(models: CatalogChoice[]): { flash: number; craft: number; forge: number } {
  const index = (re: RegExp): number => {
    const i = models.findIndex((m) => re.test(m.slug) || re.test(m.display_name));
    return i >= 0 ? i + 1 : 0;
  };
  const n = models.length;
  return {
    flash: index(/luna|mini|spark/i) || 1,
    craft: index(/terra/i) || Math.min(2, n) || 1,
    forge: index(/sol/i) || index(/astra|flagship/i) || Math.min(3, n) || 1,
  };
}

export function parsePick(raw: string, max: number, fallback: number): number {
  const text = raw.trim();
  if (!text) return fallback;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`Pick a number between 1 and ${max}`);
  }
  return n;
}

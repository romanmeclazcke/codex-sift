import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { siftHome } from "./policy.js";
import type { Policy } from "./types.js";

type ModelInfo = Record<string, unknown> & {
  slug?: string;
  display_name?: string;
  description?: string;
  visibility?: string;
  priority?: number;
};

type Catalog = { models: ModelInfo[]; [k: string]: unknown };

function parseJsonBlob(text: string): Catalog {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("No JSON object in catalog output");
  return JSON.parse(text.slice(start)) as Catalog;
}

export function injectVirtualModel(catalog: Catalog, policy: Policy): Catalog {
  const models = Array.isArray(catalog.models) ? catalog.models.map((m) => ({ ...m })) : [];
  const slug = policy.virtual_model.slug;
  const existing = models.findIndex((m) => m.slug === slug);
  const template =
    models.find((m) => m.slug === "gpt-5.6-terra") ||
    models.find((m) => m.visibility === "list") ||
    models[0];
  if (!template) return { ...catalog, models };
  const entry: ModelInfo = {
    ...template,
    slug,
    display_name: policy.virtual_model.display_name,
    description: policy.virtual_model.description,
    visibility: "list",
    supported_in_api: true,
    priority: 0,
  };
  if (existing >= 0) models[existing] = entry;
  else models.unshift(entry);
  return { ...catalog, models };
}

export function injectIntoUnknown(payload: unknown, policy: Policy): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const rec = payload as Record<string, unknown>;
  if (Array.isArray(rec.models)) return injectVirtualModel(rec as Catalog, policy);
  return payload;
}

export function loadBundledCatalog(codexBin: string): Catalog {
  const result = spawnSync(codexBin, ["debug", "models", "--bundled"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "codex debug models --bundled failed");
  }
  return parseJsonBlob(result.stdout || "");
}

export function cachedCatalogPath(codexVersion: string): string {
  return join(siftHome(), `catalog-${codexVersion.replace(/[^\w.-]+/g, "_")}.json`);
}

export function ensureInjectedCatalog(codexBin: string, policy: Policy): string {
  mkdirSync(siftHome(), { recursive: true });
  const version = spawnSync(codexBin, ["--version"], { encoding: "utf8" }).stdout.trim() || "unknown";
  const path = cachedCatalogPath(version);
  if (existsSync(path)) return path;
  const injected = injectVirtualModel(loadBundledCatalog(codexBin), policy);
  writeFileSync(path, JSON.stringify(injected));
  return path;
}

export function readCatalog(path: string): Catalog {
  return JSON.parse(readFileSync(path, "utf8")) as Catalog;
}

#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const path = join(process.env.SIFT_HOME || join(process.env.HOME || ".", ".codex-sift"), "last.json");
try {
  const last = JSON.parse(readFileSync(path, "utf8"));
  const lane = last.lane || "?";
  const model = last.model || "";
  process.stdout.write(`Sift · ${lane} · ${model}`);
} catch {
  process.stdout.write("Sift");
}

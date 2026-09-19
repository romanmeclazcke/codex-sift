#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const path = join(process.env.SIFT_HOME || process.env.HOME || ".", ".codex-sift", "last.json");
if (!existsSync(path)) {
  process.stdout.write("Sift");
  process.exit(0);
}
const last = JSON.parse(readFileSync(path, "utf8"));
const lane = last.lane || "?";
const model = last.model || "";
process.stdout.write(`Sift · ${lane} · ${model}`);

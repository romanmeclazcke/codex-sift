import { copyFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";

const root = new URL("../../", import.meta.url);
const generated = new URL("../.generated/", import.meta.url);
mkdirSync(generated, { recursive: true });

for (const path of [
  "reports/e2e-routing.json",
  "reports/model-comparison.json",
  "reports/task-completion.json",
  "benchmarks/task-completion/tasks.json",
]) {
  copyFileSync(new URL(path, root), new URL(basename(path), generated));
}

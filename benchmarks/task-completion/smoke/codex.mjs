import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const [task, outcome] = process.argv.slice(2);

if (outcome === "agent_failure") {
  console.log(JSON.stringify({ type: "turn.failed" }));
  process.exit(1);
}

if (outcome === "grader_failure") {
  writeFileSync("public.test.mjs", "throw new Error('agent checkout tests are excluded from grading');");
}

if (outcome === "pass") {
  if (task === "catalog") {
    for (const file of ["products.mjs", "catalog.mjs"]) {
      writeFileSync(file, readFileSync(file, "utf8").replaceAll("findProduct", "getProduct"));
    }
  } else {
    const fixtureFile = task === "inventory" ? "transfer.mjs" : "row.mjs";
    copyFileSync(new URL(join(task, fixtureFile), import.meta.url), fixtureFile);
  }
}

console.log(JSON.stringify({ type: "turn.completed", usage: {
  input_tokens: 100,
  cached_input_tokens: 25,
  output_tokens: 20,
} }));

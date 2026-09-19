#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runDoctor } from "./doctor.js";
import { runExplain } from "./explain.js";
import { decideTurn } from "./jev.js";
import { launchCodex } from "./launch.js";
import { writeDecision } from "./log.js";
import { bundledPolicyPath, loadPolicy, siftHome } from "./policy.js";
import { runReport } from "./report.js";

const HELP = `codex-sift — route each Codex turn to the cheapest model that can handle it

Usage:
  codex-sift [codex args...]     Launch Codex with Sift routing
  codex-sift route "prompt"      Decide a lane without calling Codex
  codex-sift explain             Show the last routing decision
  codex-sift report              Lane mix and estimated savings
  codex-sift doctor              Check Codex, auth, and Jev
  codex-sift init                Copy policy.yaml to ~/.codex-sift/

Environment:
  TYPESAFE_API_KEY     Required for live Jev judgments
  SIFT_POLICY          Extra policy YAML path
  SIFT_HOME            Default ~/.codex-sift
  SIFT_DISABLED=1      Bypass routing
  CODEX_BIN            Codex executable

Flags:
  --sift-off           Forward this invocation to Codex unchanged
  --sift-lane=forge    Skip Jev and pin a lane for this invocation
`;

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (!cmd) return launchCodex([]);
  if (cmd === "-v" || cmd === "--version" || cmd === "version") {
    process.stdout.write("codex-sift 0.1.0\n");
    return 0;
  }
  if (cmd === "doctor") return runDoctor();
  if (cmd === "explain") return runExplain();
  if (cmd === "report") return runReport();
  if (cmd === "init") return runInit();
  if (cmd === "route") return runRoute(rest);

  return launchCodex(argv);
}

async function runRoute(args: string[]): Promise<number> {
  const jsonMode = args.includes("--json");
  const prompt = args.filter((a) => a !== "--json").join(" ").trim();
  if (!prompt) {
    process.stderr.write("usage: codex-sift route [--json] <prompt>\n");
    return 1;
  }
  const policy = loadPolicy();
  const decision = await decideTurn(policy, prompt);
  writeDecision(decision, prompt);
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(
    `${decision.lane} -> ${decision.model}${decision.effort ? ` (${decision.effort})` : ""}${decision.degraded ? " [degraded]" : ""}\n${decision.reason.join("; ")}\n`,
  );
  return 0;
}

function runInit(): number {
  mkdirSync(siftHome(), { recursive: true });
  const dest = join(siftHome(), "policy.yaml");
  if (existsSync(dest)) {
    process.stdout.write(`already exists: ${dest}\n`);
    return 0;
  }
  copyFileSync(bundledPolicyPath(), dest);
  process.stdout.write(`wrote ${dest}\n`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack || err.message : err}\n`);
    process.exit(1);
  });

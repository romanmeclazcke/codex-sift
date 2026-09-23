import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "./env.js";
import { resolveCodexBin } from "./launch.js";
import { loadPolicy, siftHome } from "./policy.js";

function maskExists(path: string): boolean {
  return existsSync(path);
}

function authMode(): string {
  const authPath = join(process.env.HOME || ".", ".codex", "auth.json");
  if (!existsSync(authPath)) return "missing";
  try {
    const raw = readFileSync(authPath, "utf8");
    if (/chatgpt|tokens/i.test(raw) && !/"openai_api_key"\s*:\s*"[^"]+"/.test(raw)) return "chatgpt";
    if (/openai_api_key/.test(raw)) return "api-key";
    return "present";
  } catch {
    return "unreadable";
  }
}

export async function runDoctor(): Promise<number> {
  loadLocalEnv();
  const bin = resolveCodexBin();
  const policy = loadPolicy();
  const userPolicy = join(siftHome(), "policy.yaml");
  const lines = [
    `codex binary: ${bin}`,
    `sift home: ${siftHome()}`,
    `policy lanes: ${Object.keys(policy.lanes).join(", ")}`,
    `flash: ${policy.lanes.flash?.model}`,
    `craft: ${policy.lanes.craft?.model}`,
    `forge: ${policy.lanes.forge?.model}`,
    `virtual model: ${policy.virtual_model.slug}`,
    `context effectiveness: informational footer only (never pauses a task)`,
    `context window: ${policy.effectiveness.context_window_tokens || "Codex model catalog"}`,
    `full effectiveness until: ${policy.effectiveness.full_score_until_percent}% of context window`,
    `maximum context pressure at: ${policy.effectiveness.max_pressure_at_percent}% of context window`,
    `TYPESAFE_API_KEY: ${process.env.TYPESAFE_API_KEY ? "set" : "MISSING"}`,
    `codex auth: ${authMode()}`,
    `codex config: ${maskExists(join(process.env.HOME || ".", ".codex", "config.toml")) ? "found" : "missing"}`,
    `user policy: ${existsSync(userPolicy) ? userPolicy : "bundled defaults (run codex-sift setup)"}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (!process.env.TYPESAFE_API_KEY) {
    process.stderr.write("Set TYPESAFE_API_KEY or run `codex-sift setup` to save it.\n");
    return 1;
  }
  return 0;
}

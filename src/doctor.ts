import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
  const bin = resolveCodexBin();
  const policy = loadPolicy();
  const lines = [
    `codex binary: ${bin}`,
    `sift home: ${siftHome()}`,
    `policy lanes: ${Object.keys(policy.lanes).join(", ")}`,
    `virtual model: ${policy.virtual_model.slug}`,
    `TYPESAFE_API_KEY: ${process.env.TYPESAFE_API_KEY ? "set" : "MISSING"}`,
    `codex auth: ${authMode()}`,
    `codex config: ${maskExists(join(process.env.HOME || ".", ".codex", "config.toml")) ? "found" : "missing"}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (!process.env.TYPESAFE_API_KEY) {
    process.stderr.write("Set TYPESAFE_API_KEY from https://typesafe.ai to enable Jev routing.\n");
    return 1;
  }
  return 0;
}

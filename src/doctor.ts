import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBundledCatalog } from "./catalog.js";
import { loadLocalEnv } from "./env.js";
import { codexHome, resolveCodexBin } from "./launch.js";
import { loadPolicy, siftHome } from "./policy.js";
import { isRecord } from "./turns.js";

const PROBE = { encoding: "utf8" as const, timeout: 5000, maxBuffer: 64 * 1024 };

function hasCredential(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function savedAuth(): string | undefined {
  const authPath = join(codexHome(), "auth.json");
  try {
    const auth: unknown = JSON.parse(readFileSync(authPath, "utf8"));
    if (!isRecord(auth)) return undefined;
    if (hasCredential(auth.OPENAI_API_KEY) || hasCredential(auth.openai_api_key)) return "API key in auth.json";
    if (isRecord(auth.tokens) && hasCredential(auth.tokens.access_token)) return "ChatGPT in auth.json";
    if (auth.auth_mode === "agentIdentity" && isRecord(auth.agent_identity)) return "agent identity in auth.json";
  } catch {
    return undefined;
  }
  return undefined;
}

function authStatus(bin: string): { mode: string; level: "ready" | "degraded" | "blocked" } {
  const status = spawnSync(bin, ["login", "status"], PROBE);
  const output = [status.stdout, status.stderr].filter(Boolean).join("\n");
  if (!status.error && status.status === 0) {
    const mode = /chatgpt/i.test(output) ? "ChatGPT" : /API key/i.test(output) ? "API key" : "authenticated";
    return { mode: `${mode} (codex login status)`, level: "ready" };
  }
  if (hasCredential(process.env.OPENAI_API_KEY)) {
    return { mode: "API key in environment", level: "ready" };
  }
  if (/not logged in|no (?:active |valid )?login/i.test(output)) {
    return { mode: "missing", level: "blocked" };
  }
  const stored = savedAuth();
  return stored
    ? { mode: `${stored} (login status unavailable)`, level: "degraded" }
    : { mode: "unverified (login status unavailable)", level: "degraded" };
}

export async function runDoctor(): Promise<number> {
  loadLocalEnv();
  const bin = resolveCodexBin();
  const policy = loadPolicy();
  const userPolicy = join(siftHome(), "policy.yaml");
  const version = spawnSync(bin, ["--version"], PROBE);
  const binaryReady = !version.error && version.status === 0;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const lines = [
    `codex binary: ${bin}${binaryReady ? "" : " (unavailable)"}`,
    `sift home: ${siftHome()}`,
    `codex home: ${codexHome()}`,
    `virtual model: ${policy.virtual_model.slug}`,
    `TYPESAFE_API_KEY: ${process.env.TYPESAFE_API_KEY ? "set" : "missing"}`,
    `codex config: ${existsSync(join(codexHome(), "config.toml")) ? "found" : "missing"}`,
    `user policy: ${existsSync(userPolicy) ? userPolicy : "bundled defaults"}`,
  ];

  if (binaryReady) {
    const auth = authStatus(bin);
    lines.push(`codex auth: ${auth.mode}`);
    if (auth.level === "blocked") blockers.push("Codex needs authentication. Run `codex login`.");
    if (auth.level === "degraded") warnings.push("Codex could not verify the current login.");
  } else {
    blockers.push("Install Codex or set CODEX_BIN to a working executable.");
    lines.push("codex auth: unavailable");
  }

  if (!process.env.TYPESAFE_API_KEY) {
    warnings.push(`Jev is disabled. Requests will use the configured fallback lane (${policy.on_jev_down}).`);
  }
  if (!Object.hasOwn(policy.lanes, policy.on_jev_down)) {
    blockers.push(`Fallback lane '${policy.on_jev_down}' is missing from the policy.`);
  }

  let models: Set<string | undefined> | undefined;
  if (binaryReady) {
    try {
      const catalog = loadBundledCatalog(bin);
      if (!catalog.models.length) throw new Error("Empty catalog");
      models = new Set(catalog.models.map(({ slug }) => slug));
    } catch {
      warnings.push("The bundled Codex catalog could not be read.");
    }
  }
  for (const [lane, { model, effort }] of Object.entries(policy.lanes)) {
    const details = effort ? ` (${effort})` : "";
    lines.push(`lane ${lane}: ${model}${details}`);
    if (models && !models.has(model)) warnings.push(`Lane '${lane}' model '${model}' is absent from the bundled Codex catalog.`);
  }

  const overall = blockers.length ? "blocked" : warnings.length ? "degraded" : "ready";
  lines.push(`status: ${overall}`);
  process.stdout.write(`${lines.join("\n")}\n`);
  for (const message of blockers) process.stderr.write(`Blocked: ${message}\n`);
  for (const message of warnings) process.stderr.write(`Degraded: ${message}\n`);
  return blockers.length ? 1 : 0;
}

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contextWindows, ensureInjectedCatalog } from "./catalog.js";
import { loadLocalEnv } from "./env.js";
import { loadPolicy, siftHome } from "./policy.js";
import { startProxy } from "./proxy.js";
import type { Policy } from "./types.js";

const NO_PROXY = new Set([
  "login",
  "logout",
  "mcp",
  "plugin",
  "app",
  "completion",
  "update",
  "features",
  "sandbox",
  "debug",
  "help",
]);

const here = dirname(fileURLToPath(import.meta.url));

export function resolveCodexBin(): string {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const which = spawnSync("which", ["-a", "codex"], { encoding: "utf8" });
  const candidates = (which.stdout || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const bin of candidates) {
    if (!isSelf(bin)) return bin;
  }
  return "codex";
}

function isSelf(bin: string): boolean {
  const lower = bin.toLowerCase();
  return lower.includes("codex-sift") || lower.endsWith("/sift");
}

export function shouldProxy(argv: string[]): boolean {
  if (process.env.SIFT_DISABLED === "1") return false;
  if (argv.includes("--sift-off")) return false;
  const first = argv.find((a) => !a.startsWith("-"));
  if (first && NO_PROXY.has(first)) return false;
  return true;
}

function explicitModel(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-m" || argv[i] === "--model") return argv[i + 1] || null;
    if (argv[i].startsWith("--model=")) return argv[i].slice("--model=".length);
  }
  return null;
}

function installSkill(): void {
  const src = join(here, "..", "skills", "sift-explain", "SKILL.md");
  if (!existsSync(src)) return;
  const destDir = join(process.env.HOME || ".", ".codex", "skills", "sift-explain");
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, join(destDir, "SKILL.md"));
}

function forcedLane(argv: string[]): string | null {
  const flag = argv.find((a) => a.startsWith("--sift-lane="));
  if (flag) return flag.slice("--sift-lane=".length);
  return process.env.SIFT_FORCE_LANE || null;
}

export async function launchCodex(argv: string[], policy?: Policy): Promise<number> {
  loadLocalEnv();
  const resolved = policy || loadPolicy();
  const bin = resolveCodexBin();
  const cleaned = argv.filter((a) => a !== "--sift-off" && !a.startsWith("--sift-lane="));
  if (!shouldProxy(argv)) {
    return await exec(bin, cleaned);
  }

  const pinLane = forcedLane(argv);
  if (pinLane) {
    const spec = resolved.lanes[pinLane];
    if (!spec) throw new Error(`Unknown Sift lane '${pinLane}'`);
    return await exec(bin, ["-c", `model="${spec.model}"`, ...cleaned]);
  }

  const pinned = explicitModel(cleaned);
  if (pinned && pinned !== resolved.virtual_model.slug) {
    return await exec(bin, cleaned);
  }

  mkdirSync(siftHome(), { recursive: true });
  installSkill();
  let catalog = "";
  let windows: Record<string, number> = {};
  try {
    catalog = ensureInjectedCatalog(bin, resolved);
    windows = contextWindows(catalog);
  } catch {
    catalog = "";
  }
  const { server, url } = await startProxy(resolved, windows);

  const configArgs = [
    "-c",
    `model="${resolved.virtual_model.slug}"`,
    "-c",
    'model_provider="sift"',
    "-c",
    'model_providers.sift.name="Sift"',
    "-c",
    `model_providers.sift.base_url="${url}"`,
    "-c",
    'model_providers.sift.wire_api="responses"',
    "-c",
    "model_providers.sift.requires_openai_auth=true",
  ];
  if (catalog) {
    configArgs.push("-c", `model_catalog_json="${catalog}"`);
  }

  if (process.env.SIFT_QUIET !== "1") {
    process.stderr.write(
      `codex-sift: routing via ${url}\n  flash=${resolved.lanes.flash.model}  craft=${resolved.lanes.craft.model}  forge=${resolved.lanes.forge.model}\n`,
    );
    if (!existsSync(join(siftHome(), "policy.yaml"))) {
      process.stderr.write("Tip: run `codex-sift setup` and pick those models with 1, 2, 3.\n");
    }
  }

  try {
    return await exec(bin, [...configArgs, ...cleaned]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function exec(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      stdio: "inherit",
      env: { ...process.env, CODEX_SIFT_ACTIVE: "1" },
    });
    const stop = (signal: NodeJS.Signals) => {
      if (!child.killed) child.kill(signal);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    child.on("exit", (code, signal) => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 0);
    });
  });
}

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureInjectedCatalog } from "./catalog.js";
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
  const options = wrapperOptions(argv);
  if (options.includes("--sift-off")) return false;
  const first = options.find((arg, index) => !arg.startsWith("-")
    && !["-c", "--config", "-m", "--model", "-p", "--profile", "-C", "--cd"].includes(options[index - 1]));
  if (first && NO_PROXY.has(first)) return false;
  return true;
}

function wrapperOptions(argv: string[]): string[] {
  const separator = argv.indexOf("--");
  return separator === -1 ? argv : argv.slice(0, separator);
}

function configValue(args: string[], key: string): string | undefined {
  let value: string | undefined;
  const assignment = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    let override: string | undefined;
    if (arg === "-c" || arg === "--config") override = args[++i];
    else if (arg.startsWith("--config=")) override = arg.slice("--config=".length);
    else if (arg.startsWith("-c") && !arg.startsWith("--")) override = arg.slice(2).replace(/^=/, "");
    const parsed = override?.match(assignment)?.[1];
    if (parsed) value = parsed.replace(/^(["'])(.*)\1$/, "$2");
  }
  return value;
}

function explicitModel(args: string[]): string | undefined {
  let model: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--model" || arg === "-m") model = args[++i];
    else if (arg.startsWith("--model=")) model = arg.slice("--model=".length);
    else if (arg.startsWith("-m") && !arg.startsWith("--")) model = arg.slice(2).replace(/^=/, "");
  }
  return model ?? configValue(args, "model");
}

export function codexHome(): string {
  return process.env.CODEX_HOME || join(process.env.HOME || ".", ".codex");
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
  const bin = resolveCodexBin();
  const options = wrapperOptions(argv);
  const cleaned = [
    ...options.filter((a) => a !== "--sift-off" && !a.startsWith("--sift-lane=")),
    ...argv.slice(options.length),
  ];
  if (!shouldProxy(argv)) return await exec(bin, cleaned);

  const resolved = policy || loadPolicy();
  const codexOptions = wrapperOptions(cleaned);
  const pinned = explicitModel(codexOptions);
  if (pinned && pinned !== resolved.virtual_model.slug) return await exec(bin, cleaned);

  const pinLane = forcedLane(options);
  if (pinLane && !pinned) {
    const spec = resolved.lanes[pinLane];
    if (!spec) throw new Error(`Unknown Sift lane '${pinLane}'`);
    const overrides = ["-c", `model=${JSON.stringify(spec.model)}`];
    if (spec.effort && configValue(codexOptions, "model_reasoning_effort") === undefined) {
      overrides.push("-c", `model_reasoning_effort=${JSON.stringify(spec.effort)}`);
    }
    return await exec(bin, [...overrides, ...cleaned]);
  }

  try {
    installSkill();
  } catch {
    if (process.env.SIFT_QUIET !== "1") process.stderr.write("codex-sift: could not install the sift-explain skill\n");
  }
  const { server, url } = await startProxy(resolved);
  let catalog = "";
  try {
    catalog = ensureInjectedCatalog(bin, resolved);
  } catch {
    catalog = "";
  }

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
    function cleanup() {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
    child.once("error", (error) => {
      cleanup();
      process.stderr.write(`codex-sift: could not launch Codex (${error.message})\n`);
      resolve(1);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolve(signal ? 1 : code ?? 0);
    });
  });
}

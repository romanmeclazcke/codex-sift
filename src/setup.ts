import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadBundledCatalog } from "./catalog.js";
import { writeLocalEnvKey } from "./env.js";
import { resolveCodexBin } from "./launch.js";
import { defaultLaneIndexes, formatModelMenu, listVisibleModels, parsePick, type CatalogChoice } from "./menu.js";
import { applyLanePicks, loadPolicy, saveUserPolicy } from "./policy.js";

type SetupArgs = {
  flash?: string;
  craft?: string;
  forge?: string;
  yes?: boolean;
};

export function parseSetupArgs(argv: string[]): SetupArgs {
  const out: SetupArgs = {};
  for (const arg of argv) {
    if (arg === "--yes" || arg === "-y") out.yes = true;
    else if (arg.startsWith("--flash=")) out.flash = arg.slice("--flash=".length);
    else if (arg.startsWith("--craft=")) out.craft = arg.slice("--craft=".length);
    else if (arg.startsWith("--forge=")) out.forge = arg.slice("--forge=".length);
  }
  return out;
}

async function ask(rl: ReturnType<typeof createInterface> | null, question: string, fallback: string): Promise<string> {
  if (!rl) return fallback;
  const answer = await rl.question(question);
  return answer.trim() || fallback;
}

async function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    let value = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text === "\n" || text === "\r") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (text === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        process.exit(1);
      }
      if (text === "\u007f" || text === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += text;
    };
    const cleanup = () => {
      stdin.off("data", onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    };
    stdin.resume();
    stdin.on("data", onData);
  });
}

export async function runSetup(argv: string[]): Promise<number> {
  const flags = parseSetupArgs(argv);
  const bin = resolveCodexBin();
  let models: CatalogChoice[] = [];
  try {
    models = listVisibleModels(loadBundledCatalog(bin));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Could not read Codex models: ${message}\n`);
    return 1;
  }
  if (!models.length) {
    process.stderr.write("Codex did not return any selectable models.\n");
    return 1;
  }

  const defaults = defaultLaneIndexes(models);
  process.stdout.write(`Codex Sift setup\n\nYour Codex models:\n${formatModelMenu(models)}\n\n`);
  process.stdout.write(
    `Lanes:\n  flash = cheapest / fastest\n  craft = everyday default\n  forge = hardest work\n\n`,
  );

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !flags.yes && !flags.flash && !flags.craft && !flags.forge;
  const rl = interactive ? createInterface({ input, output }) : null;

  try {
    if (!process.env.TYPESAFE_API_KEY && interactive) {
      const key = (await askHidden("TypeSafe API key (hidden, Enter to skip): ")).trim();
      if (key) {
        const path = writeLocalEnvKey(key);
        process.stdout.write(`Saved key to ${path} (mode 600).\n`);
      } else {
        process.stdout.write("Skipped key. Export TYPESAFE_API_KEY or rerun setup.\n");
      }
    } else if (process.env.TYPESAFE_API_KEY) {
      process.stdout.write("TypeSafe API key: set\n");
    } else {
      process.stdout.write("TypeSafe API key: missing (export TYPESAFE_API_KEY)\n");
    }

    const flashRaw = flags.flash ?? (await ask(rl, `flash [${defaults.flash}]: `, String(defaults.flash)));
    const craftRaw = flags.craft ?? (await ask(rl, `craft [${defaults.craft}]: `, String(defaults.craft)));
    const forgeRaw = flags.forge ?? (await ask(rl, `forge [${defaults.forge}]: `, String(defaults.forge)));

    const picks = {
      flash: parsePick(flashRaw, models.length, defaults.flash),
      craft: parsePick(craftRaw, models.length, defaults.craft),
      forge: parsePick(forgeRaw, models.length, defaults.forge),
    };
    const policy = applyLanePicks(loadPolicy(), models, picks);
    const dest = saveUserPolicy(policy);
    process.stdout.write(
      `\nSaved ${dest}\n  flash -> ${policy.lanes.flash.model}\n  craft -> ${policy.lanes.craft.model}\n  forge -> ${policy.lanes.forge.model}\n\nNext: cd into a project and run \`codex-sift\`.\nAfter a turn, \`codex-sift explain\` shows the model that answered.\n`,
    );
    return 0;
  } finally {
    rl?.close();
  }
}

export async function runModels(): Promise<number> {
  const bin = resolveCodexBin();
  const models = listVisibleModels(loadBundledCatalog(bin));
  process.stdout.write(`${formatModelMenu(models)}\n`);
  return 0;
}

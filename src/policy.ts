import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { evalWhen } from "./expr.js";
import type { CatalogChoice } from "./menu.js";
import type { Decision, LaneName, Policy, Signals } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

export function bundledPolicyPath(): string {
  const candidates = [
    join(here, "..", "policy.yaml"),
    join(here, "policy.yaml"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error("Bundled policy.yaml is missing");
}

export function loadPolicyFile(path: string): Policy {
  const raw = parseYaml(readFileSync(path, "utf8"));
  return normalizePolicy(raw);
}

export function loadPolicy(overridePath?: string): Policy {
  const bundled = loadPolicyFile(bundledPolicyPath());
  const homePolicy = join(siftHome(), "policy.yaml");
  const layered = [homePolicy, overridePath, process.env.SIFT_POLICY].filter(
    (p): p is string => Boolean(p && existsSync(p)),
  );
  let policy = bundled;
  for (const path of layered) {
    policy = mergePolicy(policy, loadPolicyFile(path));
  }
  return policy;
}

export function siftHome(): string {
  return process.env.SIFT_HOME || join(process.env.HOME || ".", ".codex-sift");
}

function normalizePolicy(raw: unknown): Policy {
  if (!raw || typeof raw !== "object") throw new Error("Policy must be a mapping");
  const p = raw as Partial<Policy>;
  if (!p.lanes || !p.rules) throw new Error("Policy needs lanes and rules");
  return {
    jev_model: p.jev_model || "jev-1.13.0",
    jev_timeout_ms: p.jev_timeout_ms ?? 2500,
    min_confidence: p.min_confidence ?? 0.55,
    on_jev_down: p.on_jev_down || "craft",
    virtual_model: {
      slug: p.virtual_model?.slug || "sift",
      display_name: p.virtual_model?.display_name || "Sift",
      description:
        p.virtual_model?.description ||
        "Cheapest Codex model that can handle this turn, judged by Jev.",
    },
    lanes: p.lanes,
    prices_usd_per_1m: p.prices_usd_per_1m || {},
    usage_weight: p.usage_weight || {},
    effort_weight: p.effort_weight || {},
    rules: (p.rules || []).map((rule) => ({
      ...rule,
      when: String(rule.when),
    })),
  };
}

function mergePolicy(base: Policy, overlay: Policy): Policy {
  return {
    ...base,
    ...overlay,
    virtual_model: { ...base.virtual_model, ...overlay.virtual_model },
    lanes: { ...base.lanes, ...overlay.lanes },
    prices_usd_per_1m: { ...base.prices_usd_per_1m, ...overlay.prices_usd_per_1m },
    usage_weight: { ...base.usage_weight, ...overlay.usage_weight },
    effort_weight: { ...base.effort_weight, ...overlay.effort_weight },
    rules: overlay.rules.length ? overlay.rules : base.rules,
  };
}

export function signalsToValues(signals: Signals): Record<string, string | number | boolean> {
  return {
    task_kind: signals.task_kind,
    task_kind_confidence: signals.task_kind_confidence,
    difficulty: signals.difficulty,
    difficulty_confidence: signals.difficulty_confidence,
    needs_reasoning: signals.needs_reasoning,
    needs_planning: signals.needs_planning,
    high_stakes: signals.high_stakes,
    cross_cutting: signals.cross_cutting,
    is_chitchat: signals.is_chitchat,
    confidence: signals.confidence,
    has_image: signals.has_image,
  };
}

export function applyPolicy(policy: Policy, signals: Signals, extras?: { jev_ms?: number; prompt_chars?: number; degraded?: boolean }): Decision {
  const values = signalsToValues(signals);
  const matched: string[] = [];
  let lane: LaneName | undefined;
  for (const rule of policy.rules) {
    if (!evalWhen(rule.when, values)) continue;
    if (!lane) lane = rule.lane;
    matched.push(rule.reason);
    break;
  }
  if (!lane) lane = policy.on_jev_down;
  const spec = policy.lanes[lane];
  if (!spec) throw new Error(`Unknown lane '${lane}'`);
  return {
    lane,
    model: spec.model,
    effort: spec.effort,
    reason: matched.length ? matched : ["default"],
    signals,
    degraded: extras?.degraded ?? false,
    jev_ms: extras?.jev_ms ?? 0,
    prompt_chars: extras?.prompt_chars ?? 0,
  };
}

export function fallbackSignals(prompt: string, hasImage: boolean): Signals {
  const text = prompt.trim();
  const short = text.length < 140;
  const looksAsk = /^(what|why|how|where|who|explain|show|list|find)\b/i.test(text);
  const looksOps = /\b(git |npm |pnpm |yarn |pip |brew |commit|push|install)\b/i.test(text);
  const looksHard = /\b(architect|redesign|migrate|auth|security|race|deadlock|distributed)\b/i.test(text);
  const difficulty = looksHard ? 2.4 : short ? 0.6 : 1.4;
  return {
    task_kind: looksAsk ? "ask" : looksOps ? "ops" : "edit",
    task_kind_confidence: 0.4,
    difficulty,
    difficulty_confidence: 0.4,
    needs_reasoning: looksHard ? 0.8 : 0.2,
    needs_planning: looksHard ? 0.7 : 0.15,
    high_stakes: /\b(auth|prod|producti|migrat|secret|payment)\b/i.test(text) ? 0.75 : 0.1,
    cross_cutting: looksHard ? 0.7 : 0.1,
    is_chitchat: /^(hola|hello|hi|hey|buenas|ok|thanks|gracias)[\s!?.]*$/i.test(text) ? 0.9 : 0.1,
    confidence: 0.4,
    has_image: hasImage,
  };
}

export function applyLanePicks(
  policy: Policy,
  models: CatalogChoice[],
  picks: { flash: number; craft: number; forge: number },
): Policy {
  const pick = (n: number): CatalogChoice => {
    const model = models[n - 1];
    if (!model) throw new Error(`No model at position ${n}`);
    return model;
  };
  const flash = pick(picks.flash);
  const craft = pick(picks.craft);
  const forge = pick(picks.forge);
  return {
    ...policy,
    lanes: {
      ...policy.lanes,
      flash: { ...policy.lanes.flash, model: flash.slug },
      craft: { ...policy.lanes.craft, model: craft.slug },
      forge: { ...policy.lanes.forge, model: forge.slug },
    },
  };
}

export function saveUserPolicy(policy: Policy): string {
  mkdirSync(siftHome(), { recursive: true });
  const dest = join(siftHome(), "policy.yaml");
  const body = stringifyYaml(policy, { lineWidth: 0 });
  writeFileSync(
    dest,
    `# Written by \`codex-sift setup\`. Run setup again to pick models by number.\n${body}`,
  );
  return dest;
}

export function laneFromName(policy: Policy, lane: LaneName): Decision {
  const spec = policy.lanes[lane];
  if (!spec) throw new Error(`Unknown lane '${lane}'`);
  return {
    lane,
    model: spec.model,
    effort: spec.effort,
    reason: ["forced lane"],
    signals: fallbackSignals("", false),
    degraded: false,
    jev_ms: 0,
    prompt_chars: 0,
  };
}

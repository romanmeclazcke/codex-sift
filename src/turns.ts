import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

const AUX_MODELS = new Set(["codex-auto-review"]);

const AUX_PROMPT = [
  /^compact (the|this) conversation\b/i,
  /^summarize (this|the) conversation\b/i,
  /^you are (performing|running) a (code )?review\b/i,
  /^produce a (concise )?review of\b/i,
  /^automatic review\b/i,
  /^session recap\b/i,
];

const CONTEXT_BLOCK = /^<(environment_context|user_instructions|permissions_instructions|collaboration_mode|subagent_notification|skills_instructions)>[\s\S]*<\/\1>$/i;
const RETRIES = [
  /^(?:try again|retry|retry (?:it|that|the (?:last|previous) (?:task|request)))(?:$|[\s]*[.,!?])/i,
  /^redo (?:it|that|the (?:last|previous) (?:task|request))\b/i,
  /^(?:int[eé]ntalo (?:de nuevo|otra vez)|prob[aá] (?:de nuevo|otra vez)|reintent[aá](?:lo)?|volv[eé] a intentarlo|hacelo de nuevo)\b/i,
  /^(?:that|it) (?:still (?:fails|doesn['’]t work)|didn['’]t work)\b/i,
  /^(?:eso )?(?:sigue (?:fallando|sin funcionar)|no funcion[oó])\b/i,
];
const FOLLOWUPS = [
  /^(?:do|implement|apply|fix|update|explain|show|add) (?:it|that|this|those|the (?:fix|plan|change|changes|patch))\b/i,
  /^(?:continue|proceed)(?: with (?:it|that|this|the (?:plan|change|changes)))?[.!,]*$/i,
  /^(?:implement|aplic|hac|arregl|correg|agreg|mostr|explic)(?:a|á|e|é)?(?:lo|la|los|las|le)\b/i,
  /^(?:contin[uú]a|continu[aá]|segu[ií]|seguimos|proced[eé])[.!,]*$/i,
  /^(?:do|implement|apply|fix|update|explain|add) (?:the )?(?:same|other|next)\b/i,
  /^what about (?:it|that|this|those|the (?:same|other|next))\b/i,
];
const ACKNOWLEDGEMENT = /^(?:yes|yeah|ok(?:ay)?|sure|yep|go ahead|s[ií]|dale|bueno|de acuerdo)(?:[\s.,!]+|$)/i;
const POLITENESS = /^(?:please|por favor)[\s.,!]+/i;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function collectContent(node: unknown, into: { texts: string[]; images: unknown[] }): void {
  if (typeof node === "string") {
    const text = node.trim();
    if (text && !CONTEXT_BLOCK.test(text)) into.texts.push(text);
  } else if (Array.isArray(node)) {
    for (const part of node) collectContent(part, into);
  } else if (isRecord(node)) {
    if (node.type === "input_image" || node.type === "image_url" || node.type === "image") {
      into.images.push(node.image_url ?? node.file_id ?? node.source ?? node);
    } else if (node.type === "input_text" || node.type === "text" || !node.type) {
      collectContent(node.text ?? node.input_text ?? node.content ?? node.parts, into);
    }
  }
}

function inputItems(body: Record<string, unknown>): unknown[] {
  const input = body.input;
  if (Array.isArray(input)) return input;
  if (typeof input === "string") return [{ role: "user", content: input }];
  return [];
}

export function requestModel(body: Record<string, unknown>): string {
  return readString(body.model) ?? "";
}

export function lastInputItem(body: Record<string, unknown>): unknown {
  return inputItems(body).at(-1) ?? null;
}

export function isToolish(item: unknown): boolean {
  if (!isRecord(item)) return false;
  const type = readString(item.type) ?? "";
  return /function_call|tool|item_reference|_call(?:_output)?$|_output$/i.test(type) || item.role === "tool";
}

export type UserTurn = {
  text: string;
  hasImage: boolean;
  fingerprint: string;
  itemIndex: number;
};

function userTurns(items: unknown[]): UserTurn[] {
  const turns: UserTurn[] = [];
  for (const [itemIndex, item] of items.entries()) {
    if (!isRecord(item) || isToolish(item)) continue;
    if (item.role !== undefined && item.role !== "user") continue;
    if (item.type && !["message", "input_text", "input_image", "text", "image_url", "image"].includes(String(item.type))) continue;
    const content = { texts: [] as string[], images: [] as unknown[] };
    collectContent(item.content ?? item.parts ?? item, content);
    const text = content.texts.join("\n");
    if (!text && !content.images.length) continue;
    turns.push({
      text,
      hasImage: content.images.length > 0,
      fingerprint: hash(JSON.stringify([text, content.images])),
      itemIndex,
    });
  }
  return turns;
}

export function inspectTurn(body: Record<string, unknown>): {
  latest?: UserTurn;
  first?: UserTurn;
  prior?: UserTurn;
  isUserTurn: boolean;
  historyDepth: number;
} {
  const items = inputItems(body);
  const turns = userTurns(items);
  const latest = turns.at(-1);
  const afterUser = latest ? items.slice(latest.itemIndex + 1) : [];
  return {
    first: turns[0],
    prior: turns.slice(0, -1).reverse().find((turn) => taskRelation(turn.text) === "new") ?? turns.at(-2),
    latest,
    historyDepth: turns.length,
    isUserTurn: latest !== undefined
      && !isAuxiliaryModel(requestModel(body))
      && !isAuxiliaryPrompt(latest.text)
      && !afterUser.some((item) => isToolish(item) || (isRecord(item) && item.role === "assistant")),
  };
}

export function hasImage(body: Record<string, unknown>): boolean {
  return inspectTurn(body).latest?.hasImage ?? false;
}

export function extractUserTexts(body: Record<string, unknown>): string[] {
  return userTurns(inputItems(body)).map(({ text }) => text).filter(Boolean);
}

export function lastUserText(body: Record<string, unknown>): string {
  return inspectTurn(body).latest?.text ?? "";
}

export function isAuxiliaryModel(model: string): boolean {
  return AUX_MODELS.has(model) || model.includes("auto-review");
}

export function isAuxiliaryPrompt(text: string): boolean {
  return AUX_PROMPT.some((re) => re.test(text));
}

export function isNewUserTurn(body: Record<string, unknown>): boolean {
  return inspectTurn(body).isUserTurn;
}

export function taskRelation(text: string): "retry" | "followup" | "new" {
  const task = text.trim();
  const afterAck = task.replace(ACKNOWLEDGEMENT, "").replace(POLITENESS, "");
  if (RETRIES.some((pattern) => pattern.test(afterAck))) return "retry";
  if ((task && !afterAck) || FOLLOWUPS.some((pattern) => pattern.test(afterAck))) return "followup";
  return "new";
}

export function previousResponseId(body: Record<string, unknown>): string | undefined {
  return readString(body.previous_response_id);
}

function turnMetadata(body: Record<string, unknown>, headers: IncomingHttpHeaders): Record<string, unknown> {
  const client = isRecord(body.client_metadata) ? body.client_metadata : {};
  const metadata = headers["x-codex-turn-metadata"] ?? client["x-codex-turn-metadata"];
  if (isRecord(metadata)) return metadata;
  if (typeof metadata === "string") {
    try {
      const parsed: unknown = JSON.parse(metadata);
      if (isRecord(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

export function requestIdentity(body: Record<string, unknown>, headers: IncomingHttpHeaders): {
  session?: string;
  turn?: string;
} {
  const metadata = turnMetadata(body, headers);
  const conversation = isRecord(body.conversation) ? body.conversation.id : body.conversation;
  return {
    session: [
      metadata.thread_id,
      body.conversation_id,
      body.conversationId,
      conversation,
      headers["thread-id"],
      headers["x-codex-thread-id"],
      metadata.session_id,
      headers["session-id"],
      headers["x-codex-session-id"],
      body.session_id,
      body.prompt_cache_key,
    ].map(readString).find((value) => value !== undefined),
    turn: [metadata.turn_id, headers["idempotency-key"], headers["x-codex-turn-state"]]
      .map(readString).find((value) => value !== undefined),
  };
}

export function rewriteModel(
  body: Record<string, unknown>,
  model: string,
  effort?: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body, model };
  if (effort) {
    const reasoning = isRecord(body.reasoning) ? { ...body.reasoning } : {};
    reasoning.effort = effort;
    next.reasoning = reasoning;
  }
  return next;
}

export function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export type { Json };

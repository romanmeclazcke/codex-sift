const AUX_MODELS = new Set(["codex-auto-review"]);

const AUX_PROMPT = [
  /compact the conversation/i,
  /summarize (this|the) conversation/i,
  /you are (performing|running) a (code )?review/i,
  /produce a (concise )?review of/i,
  /automatic review/i,
  /session recap/i,
];

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectText(node: unknown, into: string[]): void {
  if (typeof node === "string") {
    into.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, into);
    return;
  }
  if (!isRecord(node)) return;
  if (typeof node.text === "string") into.push(node.text);
  if (typeof node.input_text === "string") into.push(node.input_text);
  if (typeof node.content === "string") into.push(node.content);
  if (node.content) collectText(node.content, into);
  if (node.parts) collectText(node.parts, into);
}

function inputItems(body: Record<string, unknown>): unknown[] {
  const input = body.input;
  if (Array.isArray(input)) return input;
  if (typeof input === "string") return [{ role: "user", content: input }];
  return [];
}

export function requestModel(body: Record<string, unknown>): string {
  return typeof body.model === "string" ? body.model : "";
}

export function lastInputItem(body: Record<string, unknown>): unknown {
  const items = inputItems(body);
  return items.length ? items[items.length - 1] : null;
}

export function isToolish(item: unknown): boolean {
  if (!isRecord(item)) return false;
  const type = String(item.type || "");
  if (/function_call|tool|item_reference/i.test(type)) return true;
  if (type.includes("output")) return true;
  if (item.role === "tool") return true;
  return false;
}

export function hasImage(body: Record<string, unknown>): boolean {
  const blob = JSON.stringify(body);
  return /input_image|image_url|"image"/i.test(blob);
}

export function extractUserTexts(body: Record<string, unknown>): string[] {
  const texts: string[] = [];
  for (const item of inputItems(body)) {
    if (!isRecord(item)) continue;
    const role = String(item.role || "");
    if (role && role !== "user") continue;
    if (isToolish(item)) continue;
    const chunk: string[] = [];
    collectText(item, chunk);
    const text = chunk.join("\n").trim();
    if (text) texts.push(text);
  }
  if (!texts.length && typeof body.input === "string") texts.push(body.input);
  return texts;
}

export function lastUserText(body: Record<string, unknown>): string {
  const texts = extractUserTexts(body);
  return texts.length ? texts[texts.length - 1] : "";
}

export function isAuxiliaryModel(model: string): boolean {
  return AUX_MODELS.has(model) || model.includes("auto-review");
}

export function isAuxiliaryPrompt(text: string): boolean {
  if (!text.trim()) return true;
  return AUX_PROMPT.some((re) => re.test(text));
}

export function isNewUserTurn(body: Record<string, unknown>): boolean {
  const model = requestModel(body);
  if (isAuxiliaryModel(model)) return false;
  if (isToolish(lastInputItem(body))) return false;
  const text = lastUserText(body);
  if (!text) return false;
  if (isAuxiliaryPrompt(text)) return false;
  return true;
}

export function conversationKey(body: Record<string, unknown>): string {
  for (const key of ["conversation_id", "conversationId", "previous_response_id"]) {
    const value = body[key];
    if (typeof value === "string" && value) return value;
  }
  const first = extractUserTexts(body)[0] || lastUserText(body);
  return `anon:${hash(first).slice(0, 16)}`;
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

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export type { Json };

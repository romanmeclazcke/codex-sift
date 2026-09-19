const PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted-openai-key]"],
  [/\bts_[A-Za-z0-9_-]{8,}\b/g, "[redacted-typesafe-key]"],
  [/\bghp_[A-Za-z0-9]{20,}\b/g, "[redacted-github-token]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[redacted-github-token]"],
  [/\bAKIA[0-9A-Z]{12,}\b/g, "[redacted-aws-key]"],
  [/\bBearer\s+[A-Za-z0-9._\-+/=]{12,}\b/gi, "Bearer [redacted]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted-private-key]"],
  [/\b(postgres|mysql|mongodb|redis):\/\/[^\s'"]+/gi, "[redacted-db-url]"],
  [/\b(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[redacted]"],
];

const MAX_CHARS = 4000;

export function redact(text: string, max = MAX_CHARS): string {
  let out = text || "";
  for (const [re, replacement] of PATTERNS) {
    out = out.replace(re, replacement);
  }
  if (out.length > max) out = `${out.slice(0, max)}\n[truncated]`;
  return out;
}

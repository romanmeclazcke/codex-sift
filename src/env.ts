import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siftHome } from "./policy.js";

export function envFilePath(): string {
  return join(siftHome(), "env");
}

export function loadLocalEnv(): void {
  const path = envFilePath();
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function writeLocalEnvKey(apiKey: string): string {
  mkdirSync(siftHome(), { recursive: true });
  const path = envFilePath();
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = existing
    .split("\n")
    .filter((line) => !line.startsWith("TYPESAFE_API_KEY="));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  lines.push(`TYPESAFE_API_KEY=${apiKey.trim()}`);
  writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  process.env.TYPESAFE_API_KEY = apiKey.trim();
  return path;
}

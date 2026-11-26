"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { NPM_URL } from "@/lib/content";

export function InstallActions({ page, spanish = false }: { page: string; spanish?: boolean }) {
  const [copied, setCopied] = useState(false);
  const command = "npx codex-sift setup";

  return (
    <div className="my-6 rounded-xl border border-line bg-wash p-4">
      <code>{command}</code>
      <div className="mt-3 flex flex-wrap gap-4">
        <button type="button" className="underline" onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            track("install_command_copied", { page });
          } catch {
            setCopied(false);
          }
        }}>
          {spanish ? "Copiar comando" : "Copy command"}
        </button>
        <a href={NPM_URL} className="underline" onClick={() => track("npm_package_clicked", { page })}>
          {spanish ? "Ver paquete en npm" : "View package on npm"}
        </a>
      </div>
      <span role="status">{copied && (spanish ? "Comando copiado" : "Command copied")}</span>
    </div>
  );
}

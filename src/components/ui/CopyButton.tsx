"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  text: string;
  /** Analytics label, e.g. "mcp-url" or "claude-code". */
  label: string;
  className?: string;
}

export default function CopyButton({ text, label, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    trackEvent("copy", { what: label });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context): the text stays selectable.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 ${className}`}
    >
      {copied ? "Copiat" : "Copia"}
    </button>
  );
}

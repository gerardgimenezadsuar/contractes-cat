"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  className?: string;
}

export default function SharePageButton({ className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const title = document.title;
    const canNativeShare = typeof navigator.share === "function";
    trackEvent("share", { page: window.location.pathname, method: canNativeShare ? "native" : "clipboard" });

    try {
      if (canNativeShare) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Error sharing page:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex min-h-9 items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 ${className}`}
    >
      {copied ? "Enllaç copiat" : "Comparteix"}
    </button>
  );
}

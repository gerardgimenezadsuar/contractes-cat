/**
 * Serialize JSON-LD defensively for inline <script> usage.
 * Escaping avoids accidental script-tag breakouts from external data.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

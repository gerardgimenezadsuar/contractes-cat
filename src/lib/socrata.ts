import { REVALIDATE_SECONDS } from "@/config/constants";

const SOCRATA_APP_TOKEN = process.env.SOCRATA_APP_TOKEN;
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [300, 1000];

class NonRetryableError extends Error {}

/**
 * Fetches a Socrata resource and parses its JSON body. Network errors,
 * timeouts, 429/5xx responses and truncated bodies are retried with backoff;
 * other 4xx responses (bad queries) fail immediately.
 */
export async function socrataFetch<T>(
  baseUrl: string,
  params: Record<string, string>,
  label = "Socrata"
): Promise<T[]> {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = {};
  if (SOCRATA_APP_TOKEN) headers["X-App-Token"] = SOCRATA_APP_TOKEN;

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        next: { revalidate: REVALIDATE_SECONDS },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`${label} API error:`, res.status, text);
        const message = `${label} API error: ${res.status}`;
        if (res.status !== 429 && res.status < 500) throw new NonRetryableError(message);
        throw new Error(message);
      }

      // Read as text first so a truncated/empty body yields a clear error
      // instead of an opaque "Unexpected end of JSON input".
      const text = await res.text();
      try {
        return JSON.parse(text) as T[];
      } catch {
        throw new Error(`${label} API returned invalid JSON (${text.length} bytes)`);
      }
    } catch (error) {
      if (error instanceof NonRetryableError || attempt >= MAX_ATTEMPTS) throw error;
      console.warn(`${label} fetch failed (attempt ${attempt}), retrying:`, error);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    }
  }
}

/**
 * Resolves to `fallback` when a non-essential section fails, so one flaky
 * upstream query doesn't take down the whole page.
 */
export async function withFallback<T>(
  promise: Promise<T>,
  fallback: T,
  label: string
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`${label} failed, rendering without it:`, error);
    return fallback;
  }
}

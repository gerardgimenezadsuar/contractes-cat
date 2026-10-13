import { track } from "@vercel/analytics";

type EventProps = Record<string, string | number | boolean | null>;

/**
 * Product analytics events (Vercel Analytics custom events). Never throws:
 * analytics must not break the UI when blocked or unavailable.
 */
export function trackEvent(name: string, props?: EventProps): void {
  try {
    track(name, props);
  } catch {
    // ignore
  }
}

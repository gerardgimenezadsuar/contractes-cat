// These listing pages read searchParams, so they render on the server for every
// request, prefetches included. A full prefetch from the header/footer meant every
// page view rendered up to five of them (with their Socrata queries) even when the
// visitor never clicked. Only prefetch routes that are served from cache.
const UNCACHED_ROUTES = new Set(["/empreses", "/persones", "/organismes", "/contractes", "/grups"]);

export function navPrefetch(href: string): boolean {
  return !UNCACHED_ROUTES.has(href);
}

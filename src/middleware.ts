import { NextResponse, type NextRequest } from "next/server";

/**
 * In development, when PROD_PROXY_URL is set, rewrite all /api/* requests to
 * the production server. This lets the local UI work without needing every
 * backend service (Turso, etc.) configured locally.
 */
export function middleware(request: NextRequest) {
  const proxyUrl = process.env.PROD_PROXY_URL;
  if (!proxyUrl) return NextResponse.next();

  const target = new URL(
    request.nextUrl.pathname + request.nextUrl.search,
    proxyUrl,
  );
  return NextResponse.rewrite(target);
}

export const config = { matcher: "/api/:path*" };

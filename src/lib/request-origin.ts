import type { NextRequest } from "next/server";

/** Check the browser origin against the public URL and the host exposed by a reverse proxy. */
export function isAllowedRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let submitted: URL;
  try {
    submitted = new URL(origin);
  } catch {
    return false;
  }
  if (!(["http:", "https:"].includes(submitted.protocol)) || origin !== submitted.origin) return false;

  const allowed = new Set([request.nextUrl.origin]);
  const configured = process.env.WORKHIVE_PUBLIC_URL?.trim();
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch { /* Invalid configuration cannot grant an origin. */ }
  }

  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProtocol === "http" || forwardedProtocol === "https") {
    for (const host of [request.headers.get("host"), request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()]) {
      if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) continue;
      try {
        allowed.add(new URL(`${forwardedProtocol}://${host}`).origin);
      } catch { /* Ignore malformed proxy headers. */ }
    }
  }

  return allowed.has(submitted.origin);
}

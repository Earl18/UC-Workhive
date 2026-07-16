import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEZONE = "Asia/Manila";
const REQUEST_TIMEOUT_MS = 1500;

type TimeProviderResult = {
  nowMs: number;
  timezone: string;
  source: string;
};

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/plain,application/json;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readInternetDateHeader(url: string, source: string): Promise<TimeProviderResult> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`${source} returned ${response.status}.`);
  }

  const dateHeader = response.headers.get("date");
  if (!dateHeader) {
    throw new Error(`${source} did not return a Date header.`);
  }

  const nowMs = new Date(dateHeader).getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error(`${source} returned an invalid Date header.`);
  }

  return {
    nowMs,
    timezone: TIMEZONE,
    source,
  };
}

function createNoStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function GET(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  const providerResults = await Promise.allSettled([
    readInternetDateHeader("https://www.google.com/generate_204", "google"),
    readInternetDateHeader("https://www.microsoft.com", "microsoft"),
    readInternetDateHeader("https://www.cloudflare.com", "cloudflare"),
  ]);

  const successes = providerResults
    .filter((result): result is PromiseFulfilledResult<TimeProviderResult> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((result) => Number.isFinite(result.nowMs));

  if (successes.length > 0) {
    const freshest = successes.reduce((latest, current) => (current.nowMs > latest.nowMs ? current : latest));
    return NextResponse.json(freshest, {
      headers: createNoStoreHeaders(),
    });
  }

  const errors = providerResults
    .map((result) =>
      result.status === "rejected"
        ? result.reason instanceof Error
          ? result.reason.message
          : "Unknown time provider error."
        : null,
    )
    .filter(Boolean);

  return NextResponse.json(
    {
      error: `Unable to fetch internet time. ${errors.join(" ")}`,
    },
    {
      status: 502,
      headers: createNoStoreHeaders(),
    },
  );
}

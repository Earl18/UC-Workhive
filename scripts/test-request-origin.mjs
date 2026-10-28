import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedRequestOrigin } from "../src/lib/request-origin.ts";

const publicOrigin = "https://workhive.example.edu";
const internalOrigin = "http://localhost:8080";

function request(origin, extraHeaders = {}) {
  return {
    headers: new Headers({ ...(origin ? { origin } : {}), ...extraHeaders }),
    nextUrl: new URL(`${internalOrigin}/api/auth/first-login-password`),
  };
}

test("accepts the configured public origin behind an internal URL", () => {
  const previous = process.env.WORKHIVE_PUBLIC_URL;
  process.env.WORKHIVE_PUBLIC_URL = publicOrigin;
  try {
    assert.equal(isAllowedRequestOrigin(request(publicOrigin)), true);
    assert.equal(isAllowedRequestOrigin(request("https://unrelated.example.edu")), false);
  } finally {
    if (previous === undefined) delete process.env.WORKHIVE_PUBLIC_URL;
    else process.env.WORKHIVE_PUBLIC_URL = previous;
  }
});

test("accepts the proxy's public host and protocol", () => {
  assert.equal(isAllowedRequestOrigin(request(publicOrigin, {
    host: "localhost:8080",
    "x-forwarded-host": "workhive.example.edu",
    "x-forwarded-proto": "https",
  })), true);
});

test("rejects unrelated, malformed, and protocol-mismatched origins", () => {
  const headers = { host: "workhive.example.edu", "x-forwarded-proto": "https" };
  assert.equal(isAllowedRequestOrigin(request("https://evil.example.edu", headers)), false);
  assert.equal(isAllowedRequestOrigin(request("http://workhive.example.edu", headers)), false);
  assert.equal(isAllowedRequestOrigin(request("null", headers)), false);
  assert.equal(isAllowedRequestOrigin(request("https://workhive.example.edu/path", headers)), false);
});

test("allows requests without an Origin header", () => {
  assert.equal(isAllowedRequestOrigin(request(null)), true);
});

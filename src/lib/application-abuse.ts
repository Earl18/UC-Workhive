export class ApplicationChallengeError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function verifyJobApplicationChallenge(token: string, hostname: string) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!siteKey && !secretKey) return;
  if (!siteKey || !secretKey) {
    throw new ApplicationChallengeError("Job application verification is not configured correctly.", 503);
  }
  if (!token || token.length > 2048) {
    throw new ApplicationChallengeError("Complete the security check before submitting.", 403);
  }

  let result: { success?: boolean; action?: string; hostname?: string };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: secretKey, response: token }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Siteverify HTTP ${response.status}`);
    result = await response.json() as typeof result;
  } catch (error) {
    console.error("Job application challenge verification failed", error);
    throw new ApplicationChallengeError("Security verification is temporarily unavailable. Please try again.", 503);
  }

  const configuredHost = process.env.WORKHIVE_PUBLIC_URL
    ? new URL(process.env.WORKHIVE_PUBLIC_URL).hostname
    : hostname;
  if (!result.success || result.action !== "job_application" || result.hostname !== configuredHost) {
    throw new ApplicationChallengeError("Security check expired or failed. Please try again.", 403);
  }
}

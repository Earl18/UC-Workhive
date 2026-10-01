import { createHmac, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AuthenticatedPortalUser } from "@/lib/auth";

type HiveConnectConfig = {
  jitsiAppId: string;
  jitsiAppSecret: string;
  jitsiBaseUrl: string;
};

export async function getHiveConnectConfig(): Promise<HiveConnectConfig> {
  const configPath = process.env.HIVECONNECT_CONFIG_PATH || path.resolve(process.cwd(), "..", "UC HiveConnect", "auth", "supabase-jitsi.local.json");
  let stored: Partial<HiveConnectConfig> = {};
  try {
    stored = JSON.parse(await readFile(configPath, "utf8")) as Partial<HiveConnectConfig>;
  } catch {
    if (!process.env.HIVECONNECT_APP_SECRET) throw new Error("UC HiveConnect configuration was not found. Set HIVECONNECT_CONFIG_PATH or the HIVECONNECT_* environment variables.");
  }
  const jitsiAppId = process.env.HIVECONNECT_APP_ID || stored.jitsiAppId;
  const jitsiAppSecret = process.env.HIVECONNECT_APP_SECRET || stored.jitsiAppSecret;
  const jitsiBaseUrl = process.env.HIVECONNECT_BASE_URL || stored.jitsiBaseUrl;
  if (!jitsiAppId || !jitsiAppSecret || !jitsiBaseUrl) {
    throw new Error("UC HiveConnect is not configured on this server.");
  }
  const url = new URL(jitsiBaseUrl);
  if (url.protocol !== "https:") throw new Error("UC HiveConnect must use HTTPS.");
  return { jitsiAppId, jitsiAppSecret, jitsiBaseUrl: url.toString().replace(/\/$/, "") };
}

export function createInterviewRoomName() {
  const letters = Array.from({ length: 10 }, () => String.fromCharCode(97 + randomInt(26))).join("");
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
}

export function interviewGuestUrl(config: HiveConnectConfig, room: string) {
  return `${config.jitsiBaseUrl}/${encodeURIComponent(room)}`;
}

export function roomFromGuestUrl(config: HiveConnectConfig, value: string) {
  try {
    const url = new URL(value);
    const base = new URL(config.jitsiBaseUrl);
    const room = decodeURIComponent(url.pathname.slice(1));
    const isWorkHiveRoom = /^workhive-interview-[0-9a-f-]{36}$/.test(room)
      || /^interview-[a-z0-9]{1,12}-[0-9a-f]{10}$/.test(room)
      || /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(room);
    return url.origin === base.origin && url.search === "" && url.hash === "" && isWorkHiveRoom ? room : null;
  } catch {
    return null;
  }
}

export function mintInterviewModeratorToken(config: HiveConnectConfig, room: string, user: AuthenticatedPortalUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "jitsi",
    iss: config.jitsiAppId,
    sub: new URL(config.jitsiBaseUrl).hostname.toLowerCase(),
    room,
    exp: now + 300,
    nbf: now - 5,
    context: { user: { id: user.id, name: user.name, email: user.email, avatar: "" } },
  };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", config.jitsiAppSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

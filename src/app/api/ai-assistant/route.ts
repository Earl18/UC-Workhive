import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type AssistantResult = { status: string; answer: string };
type PendingRequest = {
  resolve: (value: AssistantResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let worker: ChildProcessWithoutNullStreams | null = null;
let nextId = 0;
const pending = new Map<number, PendingRequest>();

function failWorker(error: Error) {
  worker = null;
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  const siblingPython = path.join(process.cwd(), "..", "UC WorkHive AI", ".venv", "Scripts", "python.exe");
  const python = process.env.HIVEBOT_PYTHON ||
    (process.platform === "win32" ? (existsSync(siblingPython) ? siblingPython : "python") : "python3");
  const script = path.join(process.cwd(), "hivebot-ai", "bridge.py");
  const child = spawn(python, [script, "--serve"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  worker = child;
  let buffer = "";
  let errorOutput = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    if (buffer.length > 16_000) {
      child.kill();
      return;
    }
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        const result: unknown = JSON.parse(line);
        if (typeof result !== "object" || result === null || !("id" in result) ||
          !("answer" in result) || !("status" in result) || typeof result.id !== "number" ||
          typeof result.answer !== "string" || typeof result.status !== "string") {
          throw new Error("Invalid model response");
        }
        const request = pending.get(result.id);
        if (request) {
          clearTimeout(request.timer);
          pending.delete(result.id);
          request.resolve(result as AssistantResult);
        }
      } catch {
        child.kill();
      }
      newline = buffer.indexOf("\n");
    }
  });
  child.stderr.on("data", (chunk: string) => { errorOutput = (errorOutput + chunk).slice(-1000); });
  child.stdin.on("error", (error) => {
    child.kill();
    if (worker === child) failWorker(error);
  });
  child.on("error", (error) => failWorker(error));
  child.on("close", (code) => {
    if (worker === child) failWorker(new Error(`HiveBot worker exited with code ${code}: ${errorOutput}`));
  });
  return child;
}

function askWorkHiveModel(question: string, role: "public" | "employee" | "hr" | "admin") {
  return new Promise<AssistantResult>((resolve, reject) => {
    if (pending.size >= 30) {
      reject(new Error("HiveBot is busy"));
      return;
    }
    const child = getWorker();
    const id = ++nextId;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("HiveBot timed out"));
      pending.delete(id);
    }, 20_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, question, role })}\n`);
  });
}

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 12_000) {
      return NextResponse.json({ success: false, error: "Message is too long" }, { status: 413 });
    }
    const body: unknown = await request.json();
    const messages = typeof body === "object" && body !== null && "messages" in body ? body.messages : null;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20 ||
      !messages.every((message) => typeof message === "object" && message !== null &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" && message.content.length <= 500)) {
      return NextResponse.json({ success: false, error: "Invalid message history" }, { status: 400 });
    }
    const latest = messages[messages.length - 1];
    if (latest.role !== "user" || !latest.content.trim()) {
      return NextResponse.json({ success: false, error: "A question is required" }, { status: 400 });
    }

    // The browser's context field is never trusted. Access comes from the signed session.
    const user = verifySessionToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
    let role: "public" | "employee" | "hr" | "admin" = "public";
    if (user && !user.mustChangePassword && user.active) {
      const current = await db.user.findUnique({
        where: { id: user.id },
        select: { role: true, active: true },
      });
      if (current?.active) {
        role = current.role === "admin" || current.role === "hr" ? current.role : "employee";
      }
    }
    const result = await askWorkHiveModel(latest.content.trim(), role);
    return NextResponse.json(
      { success: true, response: result.answer, status: result.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("HiveBot model error:", error);
    return NextResponse.json(
      { success: false, error: "HiveBot is unavailable right now. Please try again later." },
      { status: 503 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { listPortalNotifications } from "@/lib/notification-data";

function stateId(userId: string) {
  return "notification-read-" + userId;
}

function readIds(content: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(content ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(-500) : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) return auth.response;

  try {
    const [items, state] = await Promise.all([
      listPortalNotifications(auth.user),
      db.post.findUnique({ where: { id: stateId(auth.user.id) }, select: { authorId: true, content: true } }),
    ]);
    const read = new Set(state?.authorId === auth.user.id ? readIds(state.content) : []);
    return NextResponse.json(
      { notifications: items.map((item) => ({ ...item, read: read.has(item.id) })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json() as { id?: unknown; all?: unknown };
    if (body.all !== true && (typeof body.id !== "string" || body.id.length > 200)) {
      return NextResponse.json({ error: "Choose a notification to mark as read." }, { status: 400 });
    }
    const items = await listPortalNotifications(auth.user);
    const allowedIds = new Set(items.map((item) => item.id));
    const ids = body.all === true ? [...allowedIds] : allowedIds.has(body.id as string) ? [body.id as string] : [];
    if (ids.length === 0) return NextResponse.json({ ok: true });

    const id = stateId(auth.user.id);
    const existing = await db.post.findUnique({ where: { id }, select: { authorId: true, content: true } });
    if (existing && existing.authorId !== auth.user.id) {
      return NextResponse.json({ error: "Unable to update notifications." }, { status: 403 });
    }
    const read = Array.from(new Set([...readIds(existing?.content), ...ids])).slice(-500);
    const content = JSON.stringify(read);
    await db.post.upsert({
      where: { id },
      create: { id, authorId: auth.user.id, title: "Notification read state", content, published: false },
      update: { content },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to update notifications." }, { status: 500 });
  }
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortalNotification } from "@/lib/portal-notifications";

type NotificationsResponse = { notifications?: PortalNotification[]; error?: string };

async function updateReadState(body: { id: string } | { all: true }) {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json() as { error?: string };
    throw new Error(payload.error ?? "Unable to update notifications.");
  }
}

export function usePortalNotifications(userId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["portal-notifications", userId] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = await response.json() as NotificationsResponse;
      if (!response.ok) throw new Error(payload.error ?? "Unable to load notifications.");
      return payload.notifications ?? [];
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  async function markRead(id: string) {
    await updateReadState({ id });
    queryClient.setQueryData<PortalNotification[]>(queryKey, (current) =>
      current?.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  async function markAllRead() {
    await updateReadState({ all: true });
    queryClient.setQueryData<PortalNotification[]>(queryKey, (current) =>
      current?.map((item) => ({ ...item, read: true })));
  }

  return { ...query, notifications: query.data ?? [], markRead, markAllRead };
}

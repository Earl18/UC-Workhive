import type { View } from "@/lib/store";
import type { NotificationItem } from "@/lib/types";

export type PortalNotification = Pick<NotificationItem, "id" | "title" | "message" | "timestamp" | "type" | "read"> & {
  view: View;
  targetId?: string;
};

export function notificationTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

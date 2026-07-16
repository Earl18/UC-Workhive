"use client";

import { useMemo, useState } from "react";
import { useWorkHive } from "@/lib/store";
import { NotificationItem } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Plane,
  CalendarClock,
  CalendarDays,
  Video,
  Settings,
  Clock,
  CheckCheck,
  BellOff,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<NotificationItem["type"], React.ReactNode> = {
  leave: <Plane className="h-4 w-4" />,
  attendance: <CalendarClock className="h-4 w-4" />,
  interview: <Video className="h-4 w-4" />,
  holiday: <CalendarDays className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
  overtime: <Clock className="h-4 w-4" />,
};

const TYPE_COLOR: Record<NotificationItem["type"], string> = {
  leave: "#1d4ed8",
  attendance: "#0e7490",
  interview: "#7c3aed",
  holiday: "#dc2626",
  system: "#6b7280",
  overtime: "#b45309",
};

export function NotificationsPage() {
  const {
    currentUser,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useWorkHive();

  const [filter, setFilter] = useState<string>("all");

  const myNotifications = useMemo(
    () =>
      notifications
        .filter(
          (n) =>
            n.employeeId === currentUser?.employeeId ||
            (n.role === "employee" && !n.employeeId)
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [notifications, currentUser]
  );

  const unreadCount = myNotifications.filter((n) => !n.read).length;

  const filtered = useMemo(
    () =>
      filter === "all"
        ? myNotifications
        : filter === "unread"
        ? myNotifications.filter((n) => !n.read)
        : myNotifications.filter((n) => n.type === filter),
    [myNotifications, filter]
  );

  const handleMarkAll = () => {
    markAllNotificationsRead("employee", currentUser?.employeeId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Notifications</h2>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${
                  unreadCount !== 1 ? "s" : ""
                }.`
              : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notifications</SelectItem>
              <SelectItem value="unread">Unread only</SelectItem>
              <SelectItem value="leave">Leave</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="holiday">Holiday</SelectItem>
              <SelectItem value="overtime">Overtime</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total" value={myNotifications.length} icon={<Inbox className="h-4 w-4" />} />
        <MiniStat
          label="Unread"
          value={unreadCount}
          icon={<Bell className="h-4 w-4" />}
          accent="#ca8a04"
        />
        <MiniStat
          label="Read"
          value={myNotifications.length - unreadCount}
          icon={<CheckCheck className="h-4 w-4" />}
          accent="#16a34a"
        />
      </div>

      {/* List */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Notifications</CardTitle>
          <CardDescription>
            Click a notification to mark it as read.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="h-7 w-7" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                No notifications
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filter === "unread"
                  ? "You have no unread notifications."
                  : "Try changing your filter."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onClick={() => {
                    if (!n.read) markNotificationRead(n.id);
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  n,
  onClick,
}: {
  n: NotificationItem;
  onClick: () => void;
}) {
  const color = TYPE_COLOR[n.type];
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 px-1 py-4 text-left transition-colors hover:bg-accent/40 rounded-lg px-3",
          !n.read && "bg-primary/5"
        )}
      >
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {TYPE_ICON[n.type]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm",
                n.read
                  ? "font-medium text-foreground"
                  : "font-semibold text-foreground"
              )}
            >
              {n.title}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {!n.read && (
                <span className="h-2 w-2 rounded-full bg-gold" aria-label="Unread" />
              )}
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {n.timestamp}
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
          <Badge
            variant="outline"
            className="mt-1.5 text-[10px]"
            style={{ color, borderColor: `${color}40` }}
          >
            {n.type}
          </Badge>
        </div>
      </button>
    </li>
  );
}

function MiniStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-3 py-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            backgroundColor: accent ? `${accent}1a` : "rgba(30,58,138,0.1)",
            color: accent ?? "var(--primary)",
          }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

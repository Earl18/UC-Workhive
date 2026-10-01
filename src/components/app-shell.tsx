"use client";

import { startTransition, useState } from "react";
import { useTheme } from "next-themes";
import { useWorkHive, View } from "@/lib/store";
import { WorkHiveLogo } from "@/components/shared/workhive-logo";
import { HexagonAvatar } from "@/components/shared/hexagon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isViewEnabled } from "@/lib/feature-access";
import { usePortalNotifications } from "@/hooks/use-portal-notifications";
import { notificationTime, type PortalNotification } from "@/lib/portal-notifications";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, Sun, Moon, LogOut, User as UserIcon, Menu, X, Settings, CheckCheck,
  LayoutDashboard, User, CalendarClock, CalendarDays, Briefcase,
  FileText, Users, ClipboardList, BarChart3, Video, GraduationCap, ToggleLeft,
  MapPin, Mail, ScrollText, Plane, MoonStar, QrCode, Clock3,
} from "lucide-react";

const DESKTOP_SIDEBAR_WIDTH = "lg:ml-[280px]";
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "lg:ml-[72px]";
const EXPANDED_SIDEBAR_WIDTH = "w-[256px] sm:w-[280px]";
const COLLAPSED_SIDEBAR_WIDTH = "w-[72px]";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, view, setView, logout, sidebarCollapsed, toggleSidebar, setSelectedApplicantId, featureToggles } = useWorkHive();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const notificationFeed = usePortalNotifications(currentUser?.id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  if (!currentUser) return <>{children}</>;

  const role = currentUser.role;
  const nav = (NAV_GROUPS[role] ?? []).map((group) => ({
    ...group,
    items: group.items.filter((item) => isViewEnabled(item.view, featureToggles)),
  })).filter((group) => group.items.length > 0);

  const visibleNotifications = notificationFeed.notifications.filter((item) => isViewEnabled(item.view, featureToggles));
  const unreadCount = visibleNotifications.filter((item) => !item.read).length;

  const pageTitle = getPageTitle(view);
  const navigateToView = (nextView: View) => {
    startTransition(() => {
      setView(nextView);
    });
  };
  const openNotification = (item: PortalNotification) => {
    if (!item.read) {
      void notificationFeed.markRead(item.id).catch((error) => {
        toast({ title: "Unable to mark notification read", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
      });
    }
    if ((item.view === "hr:applications" || item.view === "hr:interviews") && item.targetId) {
      setSelectedApplicantId(item.targetId);
    }
    setNotificationsOpen(false);
    navigateToView(item.view);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        navGroups={nav}
        view={view}
        onNavigate={(v) => {
          navigateToView(v);
          setMobileOpen(false);
        }}
        collapsed={sidebarCollapsed && !mobileOpen}
        onToggle={toggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-all",
          sidebarCollapsed ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH : DESKTOP_SIDEBAR_WIDTH
        )}
      >
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-border bg-card/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:gap-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="shrink-0 lg:hidden">
            <WorkHiveLogo size={44} showText={false} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{pageTitle}</h1>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="font-semibold">Notifications</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void notificationFeed.markAllRead().catch((error) => {
                      toast({ title: "Unable to mark notifications read", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
                    })}
                    disabled={unreadCount === 0}
                  >
                    <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
                  </Button>
                </div>
                <div className="max-h-[min(24rem,60vh)] overflow-y-auto scroll-thin">
                  {notificationFeed.isLoading ? <p className="px-4 py-5 text-sm text-muted-foreground">Loading notifications...</p> : null}
                  {notificationFeed.isError ? <p className="px-4 py-5 text-sm text-destructive">Unable to load notifications.</p> : null}
                  {!notificationFeed.isLoading && !notificationFeed.isError && visibleNotifications.length === 0 ? <p className="px-4 py-5 text-sm text-muted-foreground">No notifications yet.</p> : null}
                  {visibleNotifications
                    .slice(0, 20)
                    .map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => openNotification(n)}
                        className={cn("w-full border-b px-4 py-3 text-left transition-colors hover:bg-accent/50 last:border-0", !n.read && "bg-primary/5")}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-muted" : "bg-gold")} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{n.title}</p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">{notificationTime(n.timestamp)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent" aria-label="Profile menu">
                  <HexagonAvatar name={currentUser.name} size={32} />
                  <div className="hidden min-w-0 text-left leading-tight sm:block">
                    <div className="max-w-[140px] truncate text-[15px] font-semibold text-foreground">{currentUser.name}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{role}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-1rem)]">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{currentUser.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{currentUser.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigateToView(role === "employee" ? "employee:profile" : role === "hr" ? "hr:master-list" : "admin:settings")}>
                  <UserIcon className="mr-2 h-4 w-4" /> My Profile
                </DropdownMenuItem>
                {role === "admin" && (
                  <DropdownMenuItem onClick={() => navigateToView("admin:settings")}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 max-w-full p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

function getPageTitle(view: View): string {
  const map: Record<View, string> = {
    "public:landing": "WorkHive",
    "public:about": "About",
    "public:careers": "Careers",
    "public:job-detail": "Job Detail",
    "public:login": "Sign In",
    "public:privacy": "Privacy Policy",
    "employee:dashboard": "Dashboard",
    "employee:profile": "My Profile",
    "employee:attendance": "Attendance History",
    "employee:time-clock": "Clock In/Clock Out",
    "employee:leave": "File a Leave",
    "employee:holidays": "Holiday Calendar",
    "employee:documents": "Documents & Certificates",
    "employee:notifications": "Notifications",
    "hr:dashboard": "HR Dashboard",
    "hr:employee-details": "Employee Details",
    "hr:master-list": "Employee Master List",
    "hr:add-employee": "Add Employee",
    "hr:attendance": "Attendance Report",
    "hr:attendance-validation": "Attendance Validation",
    "hr:attendance-summary": "Attendance Summary",
    "hr:tardiness": "Tardiness Monitoring",
    "hr:leave-management": "Leave Management",
    "hr:leave-summary": "Leave Summary Remaining",
    "hr:job-postings": "Job Postings",
    "hr:applications": "Job Applications",
    "hr:interview-scheduling": "Interview Scheduling",
    "hr:interviews": "Interview Result",
    "hr:video-conferencing": "Video Conferencing Room",
    "hr:holidays": "Holiday Calendar",
    "hr:reports": "Reports",
    "admin:dashboard": "Admin Dashboard",
    "admin:settings": "System Settings",
    "admin:feature-toggles": "Feature Toggles",
    "admin:gps-zones": "GPS Attendance Zones",
    "admin:users": "User & Role Management",
    "admin:email-templates": "Email Templates",
    "admin:audit-log": "Audit Log",
  };
  return map[view] ?? "WorkHive";
}

type NavGroup = { label: string; items: { view: View; label: string; icon: React.ComponentType<{ className?: string }> }[] };

const NAV_GROUPS: Record<string, NavGroup[]> = {
  employee: [
    {
      label: "Main",
      items: [
        { view: "employee:dashboard", label: "Dashboard", icon: LayoutDashboard },
        { view: "employee:profile", label: "My Profile", icon: User },
        { view: "employee:time-clock", label: "Clock In/Clock Out", icon: Clock3 },
        { view: "employee:attendance", label: "Attendance History", icon: CalendarClock },
        { view: "employee:leave", label: "File a Leave", icon: Plane },
      ],
    },
    {
      label: "Records",
      items: [
        { view: "employee:holidays", label: "Holiday Calendar", icon: CalendarDays },
        { view: "employee:documents", label: "Documents / Certificates", icon: FileText },
        { view: "employee:notifications", label: "Notifications", icon: Bell },
      ],
    },
  ],
  hr: [
    {
      label: "Overview",
      items: [{ view: "hr:dashboard", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "Employees",
      items: [
        { view: "hr:master-list", label: "Employee Master List", icon: Users },
      ],
    },
    {
      label: "Attendance",
      items: [
        { view: "hr:attendance", label: "Attendance Report", icon: ClipboardList },
        { view: "hr:attendance-validation", label: "Attendance Validation", icon: CheckCheck },
        { view: "hr:attendance-summary", label: "Attendance Summary", icon: BarChart3 },
        { view: "hr:tardiness", label: "Tardiness Monitoring", icon: MoonStar },
      ],
    },
    {
      label: "Leave",
      items: [
        { view: "hr:leave-management", label: "Leave Management", icon: Plane },
        { view: "hr:leave-summary", label: "Leave Summary Remaining", icon: FileText },
      ],
    },
    {
      label: "Recruitment",
      items: [
        { view: "hr:job-postings", label: "Job Postings", icon: Briefcase },
        { view: "hr:applications", label: "Job Applications", icon: Users },
        { view: "hr:interview-scheduling", label: "Interview Scheduling", icon: CalendarClock },
        { view: "hr:interviews", label: "Interview Result", icon: GraduationCap },
        { view: "hr:video-conferencing", label: "Video Conferencing", icon: Video },
      ],
    },
    {
      label: "Calendar & Reports",
      items: [
        { view: "hr:holidays", label: "Holiday Calendar", icon: CalendarDays },
        { view: "hr:reports", label: "Reports", icon: BarChart3 },
      ],
    },
  ],
  admin: [
    {
      label: "Overview",
      items: [{ view: "admin:dashboard", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "System",
      items: [
        { view: "admin:settings", label: "System Settings", icon: Settings },
        { view: "admin:feature-toggles", label: "Feature Toggles", icon: ToggleLeft },
        { view: "admin:gps-zones", label: "GPS Attendance Zones", icon: MapPin },
      ],
    },
    {
      label: "Users & Content",
      items: [
        { view: "admin:users", label: "User & Role Management", icon: Users },
        { view: "admin:email-templates", label: "Email Templates", icon: Mail },
        { view: "admin:audit-log", label: "Audit Log", icon: ScrollText },
      ],
    },
  ],
};

function Sidebar({
  navGroups,
  view,
  onNavigate,
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}: {
  navGroups: NavGroup[];
  view: View;
  onNavigate: (v: View) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={cn(
          "sidebar-honeycomb fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH,
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="logo-strip-pattern flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-3">
          {collapsed ? (
            <div className="mx-auto">
              <WorkHiveLogo size={48} showText={false} />
            </div>
          ) : (
            <WorkHiveLogo size={48} light />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={onCloseMobile}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin py-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              {!collapsed && (
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const active = view === item.view;
                  const Icon = item.icon;
                  return (
                    <li key={item.view}>
                      <button
                        onClick={() => onNavigate(item.view)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center"
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gold" />
                        )}
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-gold")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-sidebar-border p-2 lg:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : (<><Menu className="mr-2 h-4 w-4" /> Collapse</>)}
          </Button>
        </div>
      </aside>
    </>
  );
}





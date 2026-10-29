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

// Keep the content canvas wide on laptops; the full sidebar is reserved for large monitors.
const DESKTOP_SIDEBAR_WIDTH = "2xl:ml-[248px]";
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "2xl:ml-[72px]";
const EXPANDED_SIDEBAR_WIDTH = "w-[min(248px,calc(100vw-2rem))]";

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
    <div className="flex min-h-dvh min-w-0 bg-background">
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
        onOpenMobile={() => setMobileOpen(true)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[margin-left] duration-500 ease-in-out motion-reduce:transition-none sm:ml-[72px]",
          sidebarCollapsed ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH : DESKTOP_SIDEBAR_WIDTH
        )}
      >
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:pl-[76px] sm:pr-4 2xl:pl-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 sm:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className={cn("shrink-0 transition-opacity duration-500 motion-reduce:transition-none sm:hidden", mobileOpen && "pointer-events-none opacity-0")}>
            <WorkHiveLogo size={44} showText={false} />
          </div>
          <div className="hidden min-w-0 flex-1 sm:block">
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

        <main className="min-w-0 flex-1 max-w-full overflow-x-auto p-3 pb-8 sm:p-4 sm:pb-8 2xl:p-6 2xl:pb-10">{children}</main>
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
    "public:forgot-password": "Forgot Password",
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
  onOpenMobile,
  onCloseMobile,
}: {
  navGroups: NavGroup[];
  view: View;
  onNavigate: (v: View) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onOpenMobile: () => void;
  onCloseMobile: () => void;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn("fixed inset-0 z-40 bg-black/50 transition-opacity duration-500 ease-in-out motion-reduce:transition-none 2xl:hidden", mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          "sidebar-honeycomb fixed inset-y-0 left-0 z-50 flex h-dvh min-h-0 flex-col bg-sidebar text-sidebar-foreground transition-[width,translate] duration-500 ease-in-out motion-reduce:transition-none",
          EXPANDED_SIDEBAR_WIDTH,
          !mobileOpen && "sm:w-[72px] 2xl:w-[248px]",
          collapsed && !mobileOpen && "2xl:w-[72px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
      >
        <div className={cn("relative h-16 shrink-0 border-b border-sidebar-border transition-[width] duration-500 ease-in-out motion-reduce:transition-none", EXPANDED_SIDEBAR_WIDTH, mobileOpen ? "sm:w-[248px]" : "sm:w-[72px]", "2xl:w-full")}>
          <div className={cn("absolute inset-0 hidden items-center transition-opacity duration-500 motion-reduce:transition-none sm:flex 2xl:hidden", mobileOpen ? "pointer-events-none opacity-0" : "opacity-100")}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-4 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={onOpenMobile}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="ml-7 shrink-0">
              <WorkHiveLogo size={44} showText={false} />
            </div>
          </div>
          <div className={cn("absolute inset-0 flex items-center gap-2 px-3 transition-[opacity,translate,scale] duration-500 ease-in-out motion-reduce:transition-none", mobileOpen ? "translate-x-0 scale-100 opacity-100" : "pointer-events-none translate-x-0 scale-100 opacity-100 sm:-translate-x-2 sm:scale-95 sm:opacity-0 2xl:pointer-events-auto 2xl:translate-x-0 2xl:scale-100 2xl:opacity-100")}>
            <div className="relative h-full min-w-0 flex-1 overflow-hidden">
              <div className={cn("absolute inset-y-0 left-0 flex items-center transition-opacity duration-500 motion-reduce:transition-none", collapsed ? "opacity-100" : "pointer-events-none opacity-0")}>
                <WorkHiveLogo size={48} showText={false} />
              </div>
              <div className={cn("absolute inset-y-0 left-0 flex items-center transition-opacity duration-500 motion-reduce:transition-none", collapsed ? "pointer-events-none opacity-0" : "opacity-100")}>
                <WorkHiveLogo size={48} light subtitleClassName="hidden 2xl:block" />
              </div>
            </div>
            {mobileOpen && <Button
              variant="ghost"
              size="icon"
              className="shrink-0 bg-white/15 text-white hover:bg-white/25 hover:text-white focus-visible:ring-2 focus-visible:ring-white 2xl:hidden"
              onClick={onCloseMobile}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>}
          </div>
        </div>

        <nav className="hide-scrollbar min-h-0 flex-1 touch-pan-y overflow-y-auto py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className={cn("max-h-8 overflow-hidden whitespace-nowrap px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 transition-[max-height,opacity,padding] duration-500 motion-reduce:transition-none", !mobileOpen && "sm:max-h-0 sm:py-0 sm:opacity-0 2xl:max-h-8 2xl:py-1.5 2xl:opacity-100", collapsed && "2xl:max-h-0 2xl:py-0 2xl:opacity-0")}>
                {group.label}
              </p>
              <ul className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const active = view === item.view;
                  const Icon = item.icon;
                  return (
                    <li key={item.view}>
                      <button
                        onClick={() => onNavigate(item.view)}
                        title={collapsed || !mobileOpen ? item.label : undefined}
                        aria-label={item.label}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-[background-color,color,padding] duration-500 motion-reduce:transition-none",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          collapsed && "2xl:pl-[19px]",
                          !collapsed && !mobileOpen && "sm:pl-[19px] 2xl:pl-3"
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gold" />
                        )}
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-gold")} />
                        <span className={cn("min-w-0 max-w-[180px] overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-500 motion-reduce:transition-none", !mobileOpen && "sm:max-w-0 sm:opacity-0 2xl:max-w-[180px] 2xl:opacity-100", collapsed && "2xl:max-w-0 2xl:opacity-0")}>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 border-t border-sidebar-border p-2 2xl:block">
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





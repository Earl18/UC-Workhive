"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  UserPlus,
  Send,
  ShieldAlert,
  Shield,
  Users,
  UserCheck,
  Crown,
  KeyRound,
  Clock,
  Filter,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Power,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useWorkHive } from "@/lib/store";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { useAdminUsers } from "@/hooks/use-feature-toggles";
import { HexagonAvatar } from "@/components/shared/hexagon";
import { cn } from "@/lib/utils";
import type { Role, SystemUser } from "@/lib/types";

type InvitePayload = {
  name: string;
  email: string;
  role: Role;
  department?: string;
};

type UpdatePayload = {
  id: string;
  name?: string;
  email?: string;
  role?: Role;
  active?: boolean;
  department?: string | null;
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "#dc2626",
  hr: "#f59e0b",
  employee: "#1e3a8a",
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hr: "HR",
  employee: "Employee",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full system access to all modules, settings, audit logs, and user management.",
  hr: "HR access for employee records, attendance, leave, recruitment, and templates.",
  employee: "Employee access for personal profile, attendance, leave requests, and payslips.",
};

function parseTs(ts: string): number {
  const normalized = ts.includes("T") ? ts : ts.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  if (hasTimezone) {
    const direct = Date.parse(normalized);
    if (!Number.isNaN(direct)) {
      return direct;
    }
  }

  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return Number.NaN;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0),
  );
}

function relativeTime(ts?: string): string | null {
  if (!ts) return null;
  const then = parseTs(ts);
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  if (diff < 0) return null;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatTs(ts?: string): string | null {
  if (!ts) return null;
  const time = parseTs(ts);
  if (Number.isNaN(time)) return ts;

  const date = new Date(time);
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = `${date.getFullYear()}`;
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function isOnline(ts?: string): boolean {
  if (!ts) return false;
  const then = parseTs(ts);
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= 30 * 60_000;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: (T & { error?: string }) | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(response.ok ? "The server returned an invalid response." : "The server returned an invalid error response.");
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed.");
  }

  if (!payload) {
    throw new Error("The server returned an empty response.");
  }

  return payload;
}

async function createAdminUser(payload: InvitePayload) {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<{ user: SystemUser }>(response);
}

async function patchAdminUser(payload: UpdatePayload) {
  const response = await fetch(`/api/admin/users/${payload.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      role: payload.role,
      active: payload.active,
      department: payload.department,
    }),
  });
  return readJson<{ user: SystemUser }>(response);
}

async function resetAdminUserPassword(id: string) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, {
    method: "POST",
    credentials: "include",
  });
  return readJson<{ user: SystemUser }>(response);
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge
      variant="outline"
      className="border-transparent font-medium"
      style={{ backgroundColor: `${ROLE_COLORS[role]}12`, color: ROLE_COLORS[role] }}
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function PresenceBadge({ online }: { online: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        online ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600",
      )}
    >
      {online ? "Online" : "Offline"}
    </Badge>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentUser, logout } = useWorkHive();
  const { data } = useSystemSettings();
  const { data: usersData, isLoading, error } = useAdminUsers();
  const organizationName = data?.settings?.organizationName ?? "University of Cebu - South Campus";
  const users = usersData?.users ?? [];

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("employee");
  const [inviteDepartment, setInviteDepartment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SystemUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("employee");
  const [editDepartment, setEditDepartment] = useState("");
  const [resetTarget, setResetTarget] = useState<SystemUser | null>(null);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        users
          .map((user) => user.department?.trim())
          .filter((department): department is string => Boolean(department)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (departmentFilter !== "all" && (u.department?.trim() ?? "") !== departmentFilter) return false;
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "inactive" && u.active) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, departmentFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.active).length,
      employees: users.filter((u) => u.role === "employee").length,
      admins: users.filter((u) => u.role === "admin").length,
      hr: users.filter((u) => u.role === "hr").length,
    }),
    [users],
  );

  const pct = (n?: number) => (users.length ? Math.round(((n ?? 0) / users.length) * 100) : 0);

  const roleDist = useMemo(() => {
    const admin = users.filter((u) => u.role === "admin").length;
    const hr = users.filter((u) => u.role === "hr").length;
    const employee = users.filter((u) => u.role === "employee").length;
    const total = users.length || 1;
    return {
      admin,
      hr,
      employee,
      adminPct: (admin / total) * 100,
      hrPct: (hr / total) * 100,
      employeePct: (employee / total) * 100,
    };
  }, [users]);

  const inviteMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: ({ user }) => {
      queryClient.setQueryData<{ users: SystemUser[] } | undefined>(["admin-users"], (current) => ({
        users: current ? [user, ...current.users.filter((entry) => entry.id !== user.id)] : [user],
      }));
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Invitation sent", description: `${user.email} was added as ${ROLE_LABELS[user.role]}.` });
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("employee");
      setInviteDepartment("");
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to Add User",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: patchAdminUser,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["admin-users"] });
      const previous = queryClient.getQueryData<{ users: SystemUser[] } | undefined>(["admin-users"]);

      queryClient.setQueryData<{ users: SystemUser[] } | undefined>(["admin-users"], (current) => {
        const sourceUsers = current?.users ?? previous?.users ?? [];
        return {
          users: sourceUsers.map((entry) => {
            if (entry.id !== variables.id) {
              return entry;
            }

            return {
              ...entry,
              name: variables.name ?? entry.name,
              email: variables.email ?? entry.email,
              role: variables.role ?? entry.role,
              active: variables.active ?? entry.active,
              department:
                variables.department === undefined
                  ? entry.department
                  : variables.department ?? undefined,
            };
          }),
        };
      });

      return { previous };
    },
    onSuccess: ({ user }, variables) => {
      queryClient.setQueryData<{ users: SystemUser[] } | undefined>(["admin-users"], (current) => ({
        users: current ? current.users.map((entry) => (entry.id === user.id ? user : entry)) : [user],
      }));
      void queryClient.invalidateQueries({ queryKey: ["admin-users"], refetchType: "inactive" });
      if (typeof variables.active === "boolean") {
        toast({
          title: variables.active ? "Account activated" : "Account deactivated",
          description: `${user.name} is now ${variables.active ? "active" : "inactive"}.`,
        });
      } else {
        toast({ title: "User updated", description: `${user.name} details were saved.` });
      }
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-users"], context.previous);
      }
      toast({
        title: "Unable to update user",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetAdminUserPassword,
    onSuccess: ({ user }) => {
      setResetTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Password reset",
        description: `${user.name} can now sign in with the ${ROLE_LABELS[user.role]} default password.`,
      });
      if (currentUser?.id === user.id) void logout();
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to reset password",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast({ title: "Missing details", description: "Please provide name and email.", variant: "destructive" });
      return;
    }

    inviteMutation.mutate({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      department: inviteDepartment.trim() || undefined,
    });
  };

  const startEdit = (user: SystemUser) => {
    setEditTarget(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditDepartment(user.department ?? "");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditTarget(null);
    setEditName("");
    setEditEmail("");
    setEditRole("employee");
    setEditDepartment("");
  };

  const saveEdit = async () => {
    if (!editTarget) return;

    if (!editName.trim() || !editEmail.trim()) {
      toast({ title: "Missing details", description: "Name and email are required.", variant: "destructive" });
      return;
    }

    const draftTarget = editTarget;
    closeEdit();

    updateMutation.mutate({
      id: draftTarget.id,
      name: editName.trim(),
      email: editEmail.trim(),
      role: editRole,
      department: editDepartment.trim() || null,
    });
  };

  const toggleActive = (user: SystemUser, active: boolean) => {
    updateMutation.mutate({ id: user.id, active });
  };

  if (isLoading && !usersData) {
    return <div className="p-6 text-sm text-muted-foreground">Loading users...</div>;
  }

  if (error && !usersData) {
    return <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load users."}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Shield className="h-3.5 w-3.5" />
            Access Control
          </div>
          <h1 className="text-2xl font-bold text-foreground">User &amp; Role Management</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage system access for {organizationName} employees, HR officers, and administrators.
            Assign roles, activate or deactivate accounts, and invite new users.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite a new user</DialogTitle>
              <DialogDescription>An invitation email will be sent with onboarding instructions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-xs">Full Name</Label><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Juan Dela Cruz" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="juan.delacruz@gmail.com or juan.delacruz@uc.edu.ph" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Department</Label><Input value={inviteDepartment} onChange={(e) => setInviteDepartment(e.target.value)} placeholder="College of Computer Studies" /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={inviteRole} onValueChange={(v: Role) => setInviteRole(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs" style={{ color: ROLE_COLORS[inviteRole], backgroundColor: `${ROLE_COLORS[inviteRole]}0d`, borderColor: `${ROLE_COLORS[inviteRole]}33` }}>
                  <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ROLE_COLORS[inviteRole] }} aria-hidden />
                  <span><span className="font-semibold">{ROLE_LABELS[inviteRole]}:</span> {ROLE_DESCRIPTIONS[inviteRole]}</span>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={inviteMutation.isPending}>{inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send Invitation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="overflow-hidden py-0"><CardContent className="flex items-center gap-3 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Total Users</p><p className="mt-0.5 text-2xl font-bold text-foreground tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">All system accounts</p></div></CardContent></Card>
        <Card className="overflow-hidden py-0"><CardContent className="flex items-center gap-3 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><UserCheck className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Active</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-600">{counts.active}</p><p className="text-xs text-muted-foreground">{pct(counts.active)}% of total</p></div></CardContent></Card>
        <Card className="overflow-hidden py-0"><CardContent className="flex items-center gap-3 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Users className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Employee Accounts</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-blue-700">{counts.employees ?? 0}</p><p className="text-xs text-muted-foreground">{pct(counts.employees)}% of total</p></div></CardContent></Card>
        <Card className="overflow-hidden py-0"><CardContent className="flex items-center gap-3 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Crown className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">HR Accounts</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-600">{counts.hr}</p><p className="text-xs text-muted-foreground">{pct(counts.hr)}% of total</p></div></CardContent></Card>
        <Card className="overflow-hidden py-0"><CardContent className="flex items-center gap-3 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><ShieldAlert className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Administrators</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-red-600">{counts.admins}</p><p className="text-xs text-muted-foreground">{pct(counts.admins)}% of total</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-foreground">Role Distribution</p><p className="text-xs text-muted-foreground">Breakdown across {users.length} system {users.length === 1 ? "user" : "users"}</p></div></div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ROLE_COLORS.admin }} aria-hidden /><span className="text-muted-foreground">Admin</span><span className="font-semibold text-foreground tabular-nums">{roleDist.admin}</span></span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ROLE_COLORS.hr }} aria-hidden /><span className="text-muted-foreground">HR</span><span className="font-semibold text-foreground tabular-nums">{roleDist.hr}</span></span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ROLE_COLORS.employee }} aria-hidden /><span className="text-muted-foreground">Employee</span><span className="font-semibold text-foreground tabular-nums">{roleDist.employee}</span></span></div>
          </div>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted"><div className="h-full transition-all duration-500 ease-out" style={{ width: `${roleDist.adminPct}%`, backgroundColor: ROLE_COLORS.admin }} /><div className="h-full transition-all duration-500 ease-out" style={{ width: `${roleDist.hrPct}%`, backgroundColor: ROLE_COLORS.hr }} /><div className="h-full transition-all duration-500 ease-out" style={{ width: `${roleDist.employeePct}%`, backgroundColor: ROLE_COLORS.employee }} /></div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>Admin {Math.round(roleDist.adminPct)}%</span><span>HR {Math.round(roleDist.hrPct)}%</span><span>Employee {Math.round(roleDist.employeePct)}%</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound className="h-4 w-4" /></div><div><CardTitle>System Users</CardTitle><CardDescription>Assign roles and manage account access using live database records.</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, or department..." className="bg-background pl-9" /></div><div className="flex flex-wrap items-center gap-2"><Select value={roleFilter} onValueChange={(v: "all" | Role) => setRoleFilter(v)}><SelectTrigger className="h-9 w-full rounded-full bg-background px-3 sm:w-40"><span className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-muted-foreground" /><SelectValue placeholder="Role" /></span></SelectTrigger><SelectContent><SelectItem value="all">All Roles</SelectItem><SelectItem value="employee">Employee</SelectItem><SelectItem value="hr">HR</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select><Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger className="h-9 w-full rounded-full bg-background px-3 sm:w-52"><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{departmentOptions.map((department) => (<SelectItem key={department} value={department}>{department}</SelectItem>))}</SelectContent></Select><Select value={statusFilter} onValueChange={(v: "all" | "active" | "inactive") => setStatusFilter(v)}><SelectTrigger className="h-9 w-full rounded-full bg-background px-3 sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select><Badge variant="secondary" className="h-9 shrink-0 gap-1.5 rounded-full px-3 tabular-nums"><span className="text-muted-foreground">Showing</span><span className="font-semibold text-foreground">{filtered.length}</span><span className="text-muted-foreground">of {users.length}</span></Badge></div></div>
          <div className="max-h-[30rem] overflow-y-auto scroll-thin rounded-lg border border-border"><Table><TableHeader className="sticky top-0 z-10 bg-card"><TableRow className="hover:bg-transparent"><TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Presence</TableHead><TableHead>Last Login</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filtered.map((u) => { const rt = relativeTime(u.lastLogin); const fd = formatTs(u.lastLogin); return (<TableRow key={u.id} className="transition-colors hover:bg-primary/5" style={{ borderLeft: `3px solid ${ROLE_COLORS[u.role]}`, borderLeftColor: ROLE_COLORS[u.role] }}><TableCell><div className="flex items-center gap-2.5"><HexagonAvatar name={u.name} color={ROLE_COLORS[u.role]} size={30} /><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{u.name}</p><p className="truncate text-xs text-muted-foreground md:hidden">{u.email}</p></div></div></TableCell><TableCell className="hidden text-xs text-muted-foreground md:table-cell">{u.email}</TableCell><TableCell><RoleBadge role={u.role} /></TableCell><TableCell className="text-sm text-foreground">{u.department ? u.department : <span className="text-muted-foreground">-</span>}</TableCell><TableCell><StatusBadge active={u.active} /></TableCell><TableCell><PresenceBadge online={isOnline(u.lastLogin)} /></TableCell><TableCell>{u.lastLogin ? (<div className="flex items-start gap-1.5 text-xs"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><div className="flex min-w-0 flex-col leading-tight"><span className="font-medium text-foreground">{rt ?? fd}</span>{rt && fd ? <span className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{fd}</span> : null}</div></div>) : (<span className="text-xs text-muted-foreground">Never</span>)}</TableCell><TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="ml-auto h-8 w-8" aria-label={`Actions for ${u.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={() => startEdit(u)}><Pencil className="h-4 w-4" />Edit</DropdownMenuItem><DropdownMenuItem onClick={() => void toggleActive(u, !u.active)} disabled={updateMutation.isPending}><Power className="h-4 w-4" />{u.active ? "Deactivate" : "Activate"}</DropdownMenuItem><DropdownMenuItem onClick={() => setResetTarget(u)} disabled={resetPasswordMutation.isPending}><KeyRound className="h-4 w-4" />Reset Password</DropdownMenuItem><DropdownMenuSeparator /><div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">User ID: {u.id}</div></DropdownMenuContent></DropdownMenu></TableCell></TableRow>); })}{filtered.length === 0 && <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No users match the current filters.</TableCell></TableRow>}</TableBody></Table></div>
          <p className="text-xs text-muted-foreground">Showing <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> of <span className="font-medium text-foreground tabular-nums">{users.length}</span> users.</p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Info className="h-4 w-4" /></div><div className="space-y-0.5"><p className="text-sm font-semibold text-foreground">Live access control</p><p className="text-xs text-muted-foreground">User totals, role distribution, status, and last-login values now come from the database. Use the Edit action to update user details in a popup modal.</p></div></div></div>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEdit(); else setEditOpen(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the selected user details and save the changes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Full Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Juan Dela Cruz" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="juan.delacruz@gmail.com or juan.delacruz@uc.edu.ph" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Role</Label><Select value={editRole} onValueChange={(v: Role) => setEditRole(v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="hr">HR</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Department</Label><Input value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} placeholder="College of Computer Studies" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={updateMutation.isPending}>{updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open && !resetPasswordMutation.isPending) setResetTarget(null); }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!resetPasswordMutation.isPending}>
          <DialogHeader>
            <DialogTitle>Reset password to role default?</DialogTitle>
            <DialogDescription>
              {resetTarget?.name} ({resetTarget?.email}) will need the current {resetTarget ? ROLE_LABELS[resetTarget.role] : "role"} default password from System Settings to sign in. Their current password will stop working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetPasswordMutation.isPending}>Cancel</Button>
            <Button onClick={() => { if (resetTarget) resetPasswordMutation.mutate(resetTarget.id); }} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

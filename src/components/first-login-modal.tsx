"use client";

import { useState } from "react";
import { useWorkHive } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ShieldAlert,
  KeyRound, AlertTriangle,
} from "lucide-react";
import { PASSWORD_REQUIREMENTS_MESSAGE, validatePasswordRequirements } from "@/lib/role-default-passwords";
import type { SystemUser } from "@/lib/types";

export function FirstLoginModal() {
  const { currentUser, setAuthenticatedUser, logout } = useWorkHive();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const isOpen = !!currentUser?.mustChangePassword;

  // Password strength checks
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const strengthLabel = ["Very Weak", "Weak", "Fair", "Good", "Strong"][Math.min(passedChecks - 1, 4)] ?? "—";
  const strengthColor = ["#dc2626", "#ea580c", "#ca8a04", "#1d4ed8", "#16a34a"][Math.min(passedChecks - 1, 4)] ?? "#6b7280";
  const strengthPct = (passedChecks / 5) * 100;
  const match = password.length > 0 && password === confirm;
  const canSubmit = validatePasswordRequirements(password) && match;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/first-login-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json() as { user?: SystemUser; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error ?? "Unable to set your password.");
      setAuthenticatedUser(payload.user);
      toast({
        title: "Password changed successfully",
        description: "Welcome to WorkHive! You can now access your dashboard.",
      });
      setPassword("");
      setConfirm("");
    } catch (error) {
      toast({ title: "Could not set password", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    void logout();
    setPassword("");
    setConfirm("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { /* prevent closing */ }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        {/* Header with warning icon */}
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-tight">
                Welcome to WorkHive!
              </DialogTitle>
              <DialogDescription className="mt-1">
                This account is using its role&apos;s default password. Please set a new password before continuing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User info */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Signed in as</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{currentUser?.name}</p>
          <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new-password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="pl-9 pr-9"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength meter */}
            {password.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Password strength</span>
                  <span className="font-medium" style={{ color: strengthColor }}>{strengthLabel}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${strengthPct}%`, backgroundColor: strengthColor }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <StrengthCheck ok={checks.length} label="At least 8 characters" />
                  <StrengthCheck ok={checks.upper} label="One uppercase letter" />
                  <StrengthCheck ok={checks.lower} label="One lowercase letter" />
                  <StrengthCheck ok={checks.number} label="One number" />
                  <StrengthCheck ok={checks.special} label="One special character" />
                </div>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm New Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirm.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                {match ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-600">Passwords match</span></>
                ) : (
                  <><XCircle className="h-3.5 w-3.5 text-red-500" /><span className="text-red-600">Passwords don't match</span></>
                )}
              </div>
            )}
          </div>

          {/* Security note */}
          <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS_MESSAGE} Choose a password different from the role default.</p>
          <div className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <p className="text-[11px] text-muted-foreground">
              You cannot access the dashboard until you set a new password. This protects your account from unauthorized access.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out instead
            </Button>
            <Button type="submit" size="sm" disabled={loading || !canSubmit}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><KeyRound className="mr-2 h-4 w-4" /> Set Password & Continue</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StrengthCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <div className="h-3 w-3 shrink-0 rounded-full border border-muted-foreground/30" />
      )}
      <span className={`text-[10px] ${ok ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

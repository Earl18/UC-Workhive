"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, XCircle } from "lucide-react";
import { AuthBrandPanel } from "@/components/shared/auth-brand-panel";
import { HoneycombBg } from "@/components/shared/hexagon";
import { WorkHiveLogo } from "@/components/shared/workhive-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_REQUIREMENTS_MESSAGE, validatePasswordRequirements } from "@/lib/role-default-passwords";
import { PASSWORD_RESET_COMPLETED_CHANNEL, PASSWORD_RESET_REQUEST_ID_PATTERN, type PasswordResetCompleted } from "@/lib/password-reset-completion";

type Verification = "checking" | "verified" | "invalid";

export default function ResetPasswordPage() {
  const inspectedLink = useRef(false);
  const requestId = useRef("");
  const [verification, setVerification] = useState<Verification>("checking");
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (inspectedLink.current) return;
    inspectedLink.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const isRecovery = params.get("type") === "recovery";
    const token = isRecovery ? params.get("access_token") : null;
    const tokenHash = isRecovery ? params.get("token_hash") : null;
    const linkRequestId = params.get("request_id") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (PASSWORD_RESET_REQUEST_ID_PATTERN.test(linkRequestId)) requestId.current = linkRequestId;
    if (!token && !tokenHash) {
      queueMicrotask(() => setVerification("invalid"));
      return;
    }
    void (async () => {
      try {
        const response = await fetch(tokenHash ? "/api/auth/reset-password/verify" : "/api/auth/reset-password/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokenHash ? { tokenHash } : { accessToken: token }),
        });
        if (!response.ok) throw new Error("Invalid reset link");
        const payload = tokenHash ? await response.json() as { accessToken?: string } : null;
        const verifiedToken = payload?.accessToken ?? token;
        if (!verifiedToken) throw new Error("Invalid reset link");
        setAccessToken(verifiedToken);
        setVerification("verified");
      } catch {
        setVerification("invalid");
      }
    })();
  }, []);

  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One lowercase letter", ok: /[a-z]/.test(password) },
    { label: "One number", ok: /\d/.test(password) },
    { label: "One special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passedChecks = checks.filter((check) => check.ok).length;
  const matches = password.length > 0 && password === confirm;
  const canSubmit = verification === "verified" && validatePasswordRequirements(password) && matches;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, password, requestId: requestId.current || undefined }),
      });
      const payload = await response.json() as { error?: string; email?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to reset your password.");
      setDone(true);
      if (payload.email && typeof BroadcastChannel !== "undefined") {
        try {
          const channel = new BroadcastChannel(PASSWORD_RESET_COMPLETED_CHANNEL);
          channel.postMessage({ email: payload.email.trim().toLowerCase() } satisfies PasswordResetCompleted);
          channel.close();
        } catch {
          // A blocked browser channel must not turn a successful reset into an error.
        }
      }
      setAccessToken("");
      setPassword("");
      setConfirm("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-2">
      <AuthBrandPanel headline="Set a new" headlineAccent="password" subline="Choose a strong, memorable password to secure your WorkHive account. Your new password will be active immediately." features={[
        { icon: KeyRound, label: "Create New Password", desc: "Must meet security requirements" },
        { icon: ShieldCheck, label: "Encrypted & Secure", desc: "Password is never stored in plain text" },
        { icon: CheckCircle2, label: "Instant Access", desc: "Sign in right after resetting" },
      ]} />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <HoneycombBg />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden"><WorkHiveLogo size={64} /></div>
          <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2"><Link href="/?sign-in=1"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Sign In</Link></Button>
          {verification === "checking" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Verifying your reset link...</div>
          ) : verification === "invalid" ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reset link unavailable</h1>
              <p role="alert" className="text-sm text-muted-foreground">This reset link is invalid or has expired. Request a new link to continue.</p>
              <Button asChild className="w-full"><Link href="/?forgot-password=1">Request a new reset link</Link></Button>
            </div>
          ) : done ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"><Check className="h-8 w-8 text-emerald-500" /></div>
              <h1 className="text-2xl font-bold text-foreground">Password reset successfully</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your new password is now active. You can sign in to WorkHive with it right away.</p>
              <div className="mt-6 flex gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 text-left">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-medium text-foreground">Security tip</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Don&apos;t reuse this password elsewhere. Consider using a password manager to keep your credentials safe.</p>
                </div>
              </div>
              <Button asChild size="lg" className="mt-6 w-full"><Link href="/?sign-in=1">Sign in with new password <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </motion.div>
          ) : (
            <>
              <div className="mb-6">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"><ShieldCheck className="h-3 w-3" /> Secure Reset</div>
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Create new password</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Your reset link was verified. Enter your new password below.</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                  <div className="wh-input-wrap relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required className="pl-9 pr-9" />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                  {password && <div className="mt-2 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Password requirements</span><span className="font-medium text-primary">{passedChecks} of 5 met</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${passedChecks * 20}%` }} /></div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">{checks.map((check) => <span key={check.label} className={check.ok ? "text-emerald-600" : "text-muted-foreground"}>{check.ok ? "✓" : "○"} {check.label}</span>)}</div>
                  </div>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm New Password</Label>
                  <div className="wh-input-wrap relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="confirm-password" type={showConfirm ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required className="pl-9 pr-9" />
                    <button type="button" onClick={() => setShowConfirm((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showConfirm ? "Hide password" : "Show password"}>{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                  {confirm && <p className={`flex items-center gap-1.5 text-[11px] ${matches ? "text-emerald-600" : "text-destructive"}`}>{matches ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{matches ? "Passwords match" : "Passwords don't match"}</p>}
                </div>
                {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
                <Button type="submit" size="lg" className="w-full" disabled={busy || !canSubmit}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting password...</> : <><KeyRound className="mr-2 h-4 w-4" /> Reset Password</>}</Button>
                <p className="text-center text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

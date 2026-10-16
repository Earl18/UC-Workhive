"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Send, ShieldCheck, Users } from "lucide-react";
import { AuthBrandPanel } from "@/components/shared/auth-brand-panel";
import { HoneycombBg } from "@/components/shared/hexagon";
import { WorkHiveLogo } from "@/components/shared/workhive-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkHive } from "@/lib/store";
import { PASSWORD_RESET_COMPLETED_CHANNEL, type PasswordResetCompleted } from "@/lib/password-reset-completion";

const easeOut = [0.16, 1, 0.3, 1] as const;

export function ForgotPasswordPage() {
  const setView = useWorkHive((state) => state.setView);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  useEffect(() => {
    if (!sent || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(PASSWORD_RESET_COMPLETED_CHANNEL);
    const requestedEmail = email.trim().toLowerCase();
    const handleCompletion = (event: MessageEvent<PasswordResetCompleted>) => {
      if (event.data?.email !== requestedEmail) return;
      setView("public:login");
    };
    channel.addEventListener("message", handleCompletion);
    return () => {
      channel.removeEventListener("message", handleCompletion);
      channel.close();
    };
  }, [email, sent, setView]);

  useEffect(() => {
    if (!sent || !requestId) return;
    let stopped = false;
    const checkStatus = async () => {
      if (stopped) return;
      try {
        const response = await fetch(`/api/auth/reset-password/status?id=${encodeURIComponent(requestId)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const status = await response.json() as { completed?: boolean; expired?: boolean };
        if (stopped) return;
        if (status.completed) {
          stopped = true;
          window.clearInterval(timer);
          setView("public:login");
        } else if (status.expired) {
          stopped = true;
          window.clearInterval(timer);
        }
      } catch {
        // A temporary network failure is retried on the next poll.
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void checkStatus(); };
    const timer = window.setInterval(() => void checkStatus(), 3000);
    document.addEventListener("visibilitychange", onVisible);
    void checkStatus();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [requestId, sent, setView]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy || retrySeconds > 0 || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json() as { error?: string; requestId?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to send a reset link right now.");
      setRequestId(payload.requestId ?? "");
      setSent(true);
      setRetrySeconds(60);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to send a reset link right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-2">
      <AuthBrandPanel
        headline="Forgot your"
        headlineAccent="password?"
        subline="No worries — it happens to the best of us. Enter your registered email and we'll send you a secure link to reset your password."
        features={[
          { icon: ShieldCheck, label: "Secure Reset", desc: "Time-limited, single-use reset links" },
          { icon: Mail, label: "Email Verification", desc: "Only the registered email can reset" },
          { icon: Users, label: "Account Safe", desc: "Your data stays protected throughout" },
        ]}
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <HoneycombBg />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4, ease: easeOut }} className="relative w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden"><WorkHiveLogo size={64} /></div>
          <Button variant="ghost" size="sm" onClick={() => setView("public:login")} className="mb-4 -ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Sign In
          </Button>

          {!sent ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reset your password</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Enter the email address registered to your WorkHive account and we&apos;ll send you a link to reset your password.</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-sm font-medium">Registered Email</Label>
                  <div className="wh-input-wrap relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@uc.edu.ph" required autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="pl-9" />
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                  <Button type="submit" size="lg" className="w-full" disabled={busy || !email.trim()}>
                    {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending reset link...</> : <><Send className="mr-2 h-4 w-4" /> Send Reset Link</>}
                  </Button>
                </motion.div>
                {error && <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive">{error}</motion.p>}
              </form>
              <p className="mt-6 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-primary" /> For security, reset links expire. If you don&apos;t receive an email, check your spam folder or contact HR.
              </p>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: easeOut }} className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
              <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">A password reset link has been sent to</p>
              <p className="mt-1 break-all text-sm font-semibold text-foreground">{email}</p>
              <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-left">
                <p className="text-xs font-medium text-foreground">Next steps:</p>
                <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {[
                    "Open the email from WorkHive HRIS",
                    'Click the reset link in the email',
                    "Set your new password and sign in",
                  ].map((step, index) => (
                    <li key={step} className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{index + 1}</span>{step}</li>
                  ))}
                </ol>
              </div>
              {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
                Didn&apos;t get the email? {retrySeconds > 0 && `You can try again in ${retrySeconds}s.`}
              </p>
              <Button type="button" size="lg" onClick={() => void submit()} disabled={busy || retrySeconds > 0} className="mt-2 w-full">
                Try again
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

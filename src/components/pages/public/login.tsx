"use client";

import { useState, type FormEvent } from "react";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkHive } from "@/lib/store";
import { HoneycombBg } from "@/components/shared/hexagon";
import { WorkHiveLogo } from "@/components/shared/workhive-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CalendarClock,
  Briefcase,
  Users,
  Sparkles,
  Quote,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const easeOut = [0.16, 1, 0.3, 1] as const;

type LoginResponse = {
  user?: {
    id: string;
    name: string;
    email: string;
    role: "employee" | "hr" | "admin";
    employeeId?: string;
    active: boolean;
    lastLogin?: string;
  };
  error?: string;
};

export function LoginPage() {
  const { setAuthenticatedUser, setView } = useWorkHive();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { data: systemSettingsData } = useSystemSettings();
  const organizationName = systemSettingsData?.settings.organizationName ?? "University of Cebu - South Campus";
  const currentYear = new Date().getFullYear();
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, remember }),
      });

      const payload = (await response.json()) as LoginResponse;

      if (!response.ok || !payload.user) {
        toast({
          title: "Sign-in failed",
          description: payload.error ?? "Unable to sign in with that school account.",
          variant: "destructive",
        });
        return;
      }

      setAuthenticatedUser(payload.user);
      toast({
        title: "Welcome to WorkHive",
        description: "Your account has been securely signed in.",
      });
    } catch {
      toast({
        title: "Sign-in unavailable",
        description: "We could not reach the authentication service. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!email.trim()) {
      toast({
        title: "Enter your email first",
        description: "Provide your email address so we can send a reset link.",
        variant: "destructive",
      });
      return;
    }

    setResettingPassword(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      toast({
        title: "If the account exists, a reset link was sent",
        description: "Check your inbox for the password recovery email.",
      });
    } catch {
      toast({
        title: "Reset request unavailable",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-2">
      {/* ===== Left brand panel ===== */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: easeOut }}
        className="wh-gradient-mesh relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between"
      >
        <div className="sidebar-honeycomb pointer-events-none absolute inset-0 opacity-60" />
        <div className="wh-pulse-glow pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div className="wh-pulse-glow pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-primary/40 blur-3xl" style={{ animationDelay: "2.5s" }} />
        <div className="wh-pulse-glow pointer-events-none absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-gold/10 blur-3xl" style={{ animationDelay: "1.2s" }} />

        <div className="pointer-events-none absolute right-[-80px] top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 xl:block">
          <div className="wh-spin-slow h-full w-full">
            <svg viewBox="0 0 400 400" className="h-full w-full">
              <g fill="none" stroke="#f8b84e" strokeWidth="1.6" opacity="0.38">
                {[120, 150, 180].map((r, i) => (
                  <polygon
                    key={i}
                    points={Array.from({ length: 6 }, (_, k) => {
                      const a = (k * 60 - 30) * (Math.PI / 180);
                      return `${200 + r * Math.cos(a)},${200 + r * Math.sin(a)}`;
                    }).join(" ")}
                  />
                ))}
              </g>
              {Array.from({ length: 6 }).map((_, k) => {
                const a = k * 60 * (Math.PI / 180);
                const r = 180;
                return (
                  <polygon
                    key={`o${k}`}
                    points={hexPoints(200 + r * Math.cos(a), 200 + r * Math.sin(a), 10)}
                    fill="#ffc247"
                    opacity="0.82"
                  />
                );
              })}
            </svg>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0">
          {[
            { t: "16px", l: "20px", s: 84, cls: "wh-float", d: "0s", op: 0.32 },
            { t: "70%", l: "15%", s: 44, cls: "wh-float-slow", d: "1.5s", op: 0.09 },
            { t: "30%", l: "82%", s: 52, cls: "wh-float", d: "0.8s", op: 0.09 },
            { t: "82%", l: "78%", s: 38, cls: "wh-float-slow", d: "2.2s", op: 0.09 },
          ].map((h, i) => (
            <div
              key={i}
              className={`hexagon absolute bg-white ${h.cls}`}
              style={{
                top: h.t,
                left: h.l,
                width: h.s,
                height: h.s * 1.1547,
                animationDelay: h.d,
                opacity: h.op,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: easeOut }}
          className="relative z-10 p-10"
        >
          <button onClick={() => setView("public:landing")} className="flex items-center transition-transform hover:scale-[1.02]">
            <WorkHiveLogo size={56} light />
          </button>
        </motion.div>

        <div className="relative z-10 px-10 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: easeOut }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold"
          >
            <Sparkles className="h-3 w-3" /> The Hive of Modern HR
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: easeOut }}
            className="text-4xl font-bold leading-tight text-white xl:text-5xl"
          >
            One hive for
            <br />
            <span className="wh-shimmer-gold font-extrabold" data-text="every employee">every employee</span>
            <span className="text-white">.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: easeOut }}
            className="mt-4 max-w-md text-sm leading-relaxed text-white/70"
          >
            Attendance, leave, recruitment, and records - unified in a clean,
            role-aware platform built for {organizationName}.
          </motion.p>

          <div className="mt-8 space-y-3">
            {[
              { icon: CalendarClock, label: "Smart Attendance", desc: "Manual, QR & GPS geofenced time tracking" },
              { icon: Briefcase, label: "Leave & Recruitment", desc: "Multi-level approvals + interview scoring" },
              { icon: Users, label: "Role-Based Portals", desc: "Employee / HR / Admin - one hive, three views" },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.75 + i * 0.12, ease: easeOut }}
                className="group flex items-center gap-3.5"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="hexagon flex items-center justify-center bg-gradient-to-br from-primary to-primary/60 shadow-md"
                  style={{ width: 38, height: 43.88 }}
                >
                  <f.icon className="h-4 w-4 text-gold" />
                </motion.div>
                <div>
                  <div className="text-sm font-semibold text-white">{f.label}</div>
                  <div className="text-xs text-white/55">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.1, ease: easeOut }}
          className="relative z-10 px-10 pb-10"
        >
          <div className="max-w-xl rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <Quote className="h-4 w-4 text-gold" />
            <p className="mt-2 text-sm italic text-white/80">
              "Bee efficient. Bee organized. WorkHive brought our HR records into one place."
            </p>
            <p className="mt-2 text-xs font-medium text-white/50">- {organizationName} HR Team</p>
          </div>
          <p className="mt-5 text-[11px] text-white/40">
            (c) {currentYear} {organizationName} - Human Resource Department
          </p>
        </motion.div>
      </motion.div>

      {/* ===== Right form panel ===== */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <HoneycombBg />

        <div className="absolute left-4 top-4 flex items-center gap-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setView("public:landing")} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: easeOut }}
          className="relative w-full max-w-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5, ease: easeOut }}
            className="mb-6 flex justify-center lg:hidden"
          >
            <div className="wh-bob">
              <WorkHiveLogo size={64} />
            </div>
          </motion.div>

          <Button variant="ghost" size="sm" onClick={() => setView("public:landing")} className="mb-4 -ml-2 hidden lg:flex">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Home
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: easeOut }}
            className="mb-6"
          >
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in with your registered email account to continue. University email is recommended when available.
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: easeOut }}
            onSubmit={submit}
            className="space-y-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.75, ease: easeOut }}
              className="space-y-1.5"
            >
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="wh-input-wrap relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com or you@uc.edu.ph"
                  required
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="pl-9"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.85, ease: easeOut }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                  onClick={requestPasswordReset}
                  disabled={resettingPassword || loading}
                >
                  {resettingPassword ? "Requesting reset..." : "Forgot password?"}
                </button>
              </div>
              <div className="wh-input-wrap relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  autoComplete="current-password"
                  className="pl-9 pr-9"
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
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.95, ease: easeOut }}
              className="flex items-center gap-2"
            >
              <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
              <Label htmlFor="remember" className="cursor-pointer text-sm text-muted-foreground">
                Keep me signed in
              </Label>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.05, ease: easeOut }}
              className="rounded-xl border border-primary/10 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground"
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>
                  Authorized school accounts only. Sign-in now uses server-side verification, secure session cookies, and failed-attempt lockouts.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.15, ease: easeOut }}
            >
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button type="submit" size="lg" className="relative w-full overflow-hidden" disabled={loading || resettingPassword}>
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <AnimatePresence mode="wait" initial={false}>
                    {loading ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center"
                      >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center"
                      >
                        <LogIn className="mr-2 h-4 w-4" /> Sign In to WorkHive
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </motion.div>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.3 }}
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            Need an account provisioned? Contact HR or campus IT, or{" "}
            <button onClick={() => setView("public:careers")} className="font-medium text-primary hover:underline">
              browse open positions
            </button>
            .
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (k * 60 - 30) * (Math.PI / 180);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}



"use client";

import { usePublicSiteStats } from "@/hooks/use-public-site-stats";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { PublicHeader, PublicFooter } from "./layout";
import { HoneycombBg } from "@/components/shared/hexagon";
import { Card, CardContent } from "@/components/ui/card";
import {
  Target,
  Eye,
  Heart,
  FileText,
  Clock,
  CalendarDays,
  CalendarClock,
  Users,
  Building2,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

const timeline = [
  {
    year: "Current",
    title: "Discovery & Audit",
    description:
      "From the past and currently used by the HR, manual and paper-based processes have been handling records, leave approvals, attendance logging, and document verification across the South Campus.",
    icon: FileText,
  },
  {
    year: "June 2026",
    title: "WorkHive Conception",
    description:
      "A cross-functional team designed WorkHive in June 2026 as a single, role-aware platform built around the honeycomb motif representing every interconnected employee.",
    icon: Sparkles,
  },
  {
    year: "Sept 2026",
    title: "Pilot Rollout",
    description:
      "Smart attendance, leave management, and the document vault are planned for pilot rollout in September 2026 for the HR Department and the College of Computer Studies.",
    icon: Clock,
  },
  {
    year: "2027",
    title: "Campus-wide Adoption",
    description:
      "Campus-wide adoption is planned for 2027, when WorkHive will serve faculty and staff across all departments on the South Campus with HR, Admin, and Employee roles.",
    icon: ShieldCheck,
  },
] as const;

const capabilities = [
  {
    icon: Clock,
    title: "Smart Attendance",
    points: [
      "Manual time-in/out or QR scanner",
      "Late, undertime, and overtime auto-computed",
      "Real-time daily attendance log",
    ],
  },
  {
    icon: CalendarDays,
    title: "Leave Management",
    points: [
      "Vacation, sick, maternity, paternity, solo-parent, and Summer Incentive Leave for College of Nursing",
      "Multi-tier approval workflow with HR routing",
      "Live leave-credit balance tracking",
    ],
  },
  {
    icon: GraduationCap,
    title: "Document Vault",
    points: [
      "Diplomas, transcripts, PRC licenses, certificates",
      "Timestamped uploads with verification status",
      "Searchable per-employee document timeline",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Role-based Access",
    points: [
      "Row-level-security-style permissions",
      "Employee, HR, and Admin roles",
      "Audit trail on every record change",
    ],
  },
] as const;

export function AboutPage() {
  const statsQuery = usePublicSiteStats();
  const { data } = useSystemSettings();
  const settings = data?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const stats = statsQuery.data;

  return (
    <div className="relative flex min-h-screen flex-col">
      <PublicHeader />
      <HoneycombBg />
      <main className="flex-1">
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
            <div className="max-w-6xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold">
                <span className="h-2 w-2 rounded-full bg-gold" />
                About WorkHive
              </div>
              <h1 className="mt-6 max-w-5xl text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Digitizing human resources for <span className="text-gold">{organizationName}</span>.
              </h1>
              <p className="mt-6 max-w-4xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                WorkHive is the official Human Resources Information System of University of
                Cebu - South Campus. It replaces paper-based records, manual leave approvals,
                and ad-hoc attendance sheets with one secure, role-aware platform built for
                every faculty and staff member.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="relative overflow-hidden border-border/80 shadow-sm">
              <CardContent className="p-7 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="relative h-[42px] w-[42px] shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                      <path d="M50 4 L91 27 L91 73 L50 96 L9 73 L9 27 Z" fill="#1e3a8a" stroke="#f59e0b" strokeWidth="5" />
                    </svg>
                    <Target className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Our Mission</h2>
                </div>
                <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  To modernize {organizationName} HR operations through a unified, secure, and employee-first platform by digitizing attendance, leave, document management, and notifications so every faculty and staff member can focus on teaching and serving students, not paperwork.
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-border/80 shadow-sm">
              <CardContent className="p-7 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="relative h-[42px] w-[42px] shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                      <path d="M50 4 L91 27 L91 73 L50 96 L9 73 L9 27 Z" fill="#1e3a8a" stroke="#f59e0b" strokeWidth="5" />
                    </svg>
                    <Eye className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Our Vision</h2>
                </div>
                <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  A campus where every HR interaction is transparent, every record is verifiable, and every employee has instant, secure access to the information they need exactly when they need it.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="relative mx-auto mt-6 w-full max-w-3xl overflow-hidden border-border/80 shadow-sm">
            <CardContent className="p-7 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="relative h-[42px] w-[42px] shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                    <path d="M50 4 L91 27 L91 73 L50 96 L9 73 L9 27 Z" fill="#1e3a8a" stroke="#f59e0b" strokeWidth="5" />
                  </svg>
                  <Heart className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-foreground sm:text-3xl">Values</h3>
              </div>
              <ul className="mt-6 space-y-2 text-base text-muted-foreground sm:text-lg">
                <li>Accuracy over speed</li>
                <li>Transparency in every record</li>
                <li>Respect for employee privacy</li>
                <li>Continuous digital improvement</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="relative overflow-hidden" style={{ background: "linear-gradient(to bottom right, #3d6af0 0%, #1f4cae 45%, #14356f 100%)" }}>
          <div className="sidebar-honeycomb absolute inset-0 opacity-25" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
            <div className="grid grid-cols-2 gap-8 text-center text-white lg:grid-cols-4">
              {[
                { label: "Employees", value: stats?.employeeCount ?? 0, icon: Users },
                { label: "Departments", value: stats?.departmentCount ?? 0, icon: Building2 },
                { label: "Open Job Postings", value: stats?.activeJobPostingCount ?? 0, icon: Briefcase },
                { label: "Holidays Tracked", value: stats?.holidayCount ?? 0, icon: CalendarClock },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label}>
                    <div className="mb-2 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-gold" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight sm:text-4xl">
                      {stat.value.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/75 sm:text-sm">
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-primary">
                <span className="h-px w-6 bg-gold" />
                The Journey
                <span className="h-px w-6 bg-gold" />
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                From paper folders to a digital hive.
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                The road from manual HR records to a unified HRMS built campus-first.
              </p>
            </div>

            <div className="relative mt-12">
              <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gold/50 md:block" />
              <div className="space-y-8 md:space-y-0">
                {timeline.map((step, index) => {
                  const Icon = step.icon;
                  const isLeft = index % 2 === 0;
                  const card = (
                    <div className={`md:w-1/2 ${isLeft ? "md:pr-8 md:text-right" : "md:pl-8"}`}>
                      <Card className="border-border/80 shadow-sm">
                        <CardContent className="p-6 sm:p-7">
                          <div className={`flex items-start gap-3 ${isLeft ? "md:flex-row-reverse" : ""}`}>
                            <div className="relative h-[40px] w-[40px] shrink-0">
                              <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                                <path d="M50 4 L91 27 L91 73 L50 96 L9 73 L9 27 Z" fill="#1e3a8a" stroke="#f59e0b" strokeWidth="5" />
                              </svg>
                              <Icon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-primary">{step.year}</div>
                              <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                            </div>
                          </div>
                          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                            {step.description}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  );

                  return (
                    <div key={step.year} className={`relative md:flex md:items-center ${index !== timeline.length - 1 ? "md:mb-10" : ""}`}>
                      {isLeft ? card : <div className="hidden md:block md:w-1/2" />}
                      <div className="relative hidden md:block md:w-0">
                        <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold ring-4 ring-background" />
                      </div>
                      {isLeft ? <div className="hidden md:block md:w-1/2" /> : card}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-primary">
                <span className="h-px w-6 bg-gold" />
                What WorkHive Does
                <span className="h-px w-6 bg-gold" />
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Four pillars. One platform.
              </h2>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {capabilities.map((capability) => {
                const Icon = capability.icon;
                return (
                  <Card key={capability.title} className="h-full border-border/80 shadow-sm">
                    <CardContent className="p-6 sm:p-7">
                      <div className="flex items-center gap-3">
                        <div className="relative h-[44px] w-[44px] shrink-0">
                          <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                            <path d="M50 4 L91 27 L91 73 L50 96 L9 73 L9 27 Z" fill="#1e3a8a" stroke="#f59e0b" strokeWidth="5" />
                          </svg>
                          <Icon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground">{capability.title}</h3>
                      </div>
                      <ul className="mt-6 space-y-3">
                        {capability.points.map((point) => (
                          <li key={point} className="flex items-start gap-2 text-base text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">What WorkHive Delivers</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Three role-based portals, each tuned to the needs of its users, all sharing one consistent, audit-friendly data layer.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  role: "Employee Portal",
                  items: ["My Profile & Education Tiers", "Attendance (Manual + QR)", "Leave Filing & Status Tracker", "Holiday Calendar", "Documents & Certificates"],
                  color: "#1e3a8a",
                },
                {
                  role: "HR Portal",
                  items: ["Employee Master List + Import", "Attendance Report & Summary", "Leave Management & Credits", "Recruitment & Interview Scoring", "Tardiness Monitoring"],
                  color: "#f59e0b",
                },
                {
                  role: "Admin Portal",
                  items: ["Feature Toggles", "GPS Geofence Zones", "User & Role Management", "Branded Email Templates", "Audit Log"],
                  color: "#0e7490",
                },
              ].map((portal) => (
                <Card key={portal.role}>
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="hexagon inline-block" style={{ width: 16, height: 18.5, backgroundColor: portal.color }} />
                      <h3 className="text-lg font-semibold">{portal.role}</h3>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {portal.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: portal.color }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}




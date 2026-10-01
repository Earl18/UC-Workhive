"use client";

import { useEffect, useState } from "react";
import { useWorkHive } from "@/lib/store";
import { usePublicSiteStats } from "@/hooks/use-public-site-stats";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { PublicHeader, PublicFooter } from "./layout";
import { HoneycombBg, HexagonCluster, HexagonAvatar } from "@/components/shared/hexagon";
import { WorkHiveLogo } from "@/components/shared/workhive-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarClock, Plane, Briefcase, Users, BarChart3, ShieldCheck,
  ArrowRight, ArrowUp, Hexagon, FileText, Clock, Award, Building2, Quote,
} from "lucide-react";

export function LandingPage() {
  const { setView } = useWorkHive();
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const { data } = useSystemSettings();
  const statsQuery = usePublicSiteStats();
  const settings = data?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const stats = statsQuery.data;

  useEffect(() => {
    const updateScrollToTop = () => setShowScrollToTop(window.scrollY > 400);
    updateScrollToTop();
    window.addEventListener("scroll", updateScrollToTop, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollToTop);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <HoneycombBg />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(520px,0.9fr)] lg:gap-20">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
                  <Hexagon className="h-3 w-3" />
                  {organizationName} HRMS
                </div>
                <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                  Modernizing
                  <br />
                  <span className="font-extrabold tracking-tight">
                    <span className="uppercase text-primary">{organizationName}</span>
                    <span className="text-gold">,</span> one hexagon at a time
                    <span className="text-gold">.</span>
                  </span>
                </h1>
                <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                  {organizationName} HR has long run on manual forms, spreadsheets, and
                  paper records.{" "}
                  <span className="font-semibold">
                    <span className="text-primary">Work</span><span className="text-gold">Hive</span>
                  </span>{" "}
                  changes that, bringing attendance, leave, recruitment, and employee
                  records into one centralized, role-based system. Less paper. More
                  progress.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button size="lg" onClick={() => setView("public:login")}>
                    Sign In to WorkHive <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setView("public:careers")}>
                    <Briefcase className="mr-2 h-4 w-4" /> View Job Postings
                  </Button>
                </div>
                <div className="mt-10 flex items-center gap-6">
                  <HexagonCluster size={26} />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Single-campus. Role-aware.</p>
                    <p>Employee / HR / Admin portals - one hive, three views.</p>
                  </div>
                </div>
              </div>

              {/* Hero visual: honeycomb cluster of feature hexagons */}
              <div className="relative hidden lg:block">
                <HeroHexagonCluster />
              </div>
            </div>
          </div>
        </section>


        {/* About + What WorkHive Does */}
        <section className="relative">
          <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 md:pb-20 md:pt-28">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <span className="h-px w-6 bg-gold" />
                  About WorkHive
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  The digital backbone of {organizationName} HR.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                  For decades, the {organizationName} HR Department ran on
                  paper folders, scattered spreadsheets, and hallway follow-ups. WorkHive
                  replaces that with a single, secure, role-aware platform - bringing
                  attendance, leave, documents, and notifications under one roof.
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Every faculty and staff member gets a personal dashboard. Every record is
                  timestamped and verifiable. Every approval has a transparent trail.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button size="lg" onClick={() => setView("public:about")}>
                    Learn More About WorkHive <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:w-full lg:max-w-[700px] lg:justify-self-end">
                <Stat n={stats?.employeeCount ?? 0} label="Employees" icon={<Users className="h-5 w-5" />} year={stats?.yearLabel} />
                <Stat n={stats?.departmentCount ?? 0} label="Departments" icon={<Building2 className="h-5 w-5" />} year={stats?.yearLabel} />
                <Stat n={stats?.activeJobPostingCount ?? 0} label="Open Job Postings" icon={<Briefcase className="h-5 w-5" />} accent year={stats?.yearLabel} />
                <Stat n={stats?.holidayCount ?? 0} label="Holidays Tracked" icon={<CalendarClock className="h-5 w-5" />} year={stats?.yearLabel} />
              </div>
            </div>

            <div className="mx-auto mt-40 max-w-3xl text-center">
              <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-primary">
                <span className="h-px w-6 bg-gold" />
                What WorkHive Does
                <span className="h-px w-6 bg-gold" />
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Six modules. One unified HR experience.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Each module is designed to replace a paper process - and to make the employee's day
                a little easier.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Feature
                icon={<CalendarClock className="h-5 w-5" />}
                title="Smart Attendance"
                desc="Manual Time In/Out, QR scanning, holiday-aware reports, and overtime approval workflows - with GPS geofencing for the admin."
              />
              <Feature
                icon={<Plane className="h-5 w-5" />}
                title="Leave Management"
                desc="File vacation, sick, maternity, paternity and more. Track a single HR approval for each leave request."
                accent
              />
              <Feature
                icon={<Briefcase className="h-5 w-5" />}
                title="Recruitment"
                desc="Post jobs, track applicants through Kanban stages, schedule video or face-to-face interviews, and score on a 10-criteria rubric."
              />
              <Feature
                icon={<Users className="h-5 w-5" />}
                title="Employee Master List"
                desc="Normalized employee records with employment status monitoring, education tiers, and uploaded documents/certificates."
              />
              <Feature
                icon={<BarChart3 className="h-5 w-5" />}
                title="Reports & Tardiness"
                desc="Attendance summaries for Accounting, tardiness trend monitoring, and leave credit balances - all exportable."
              />
              <Feature
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Role-Based Access"
                desc="Three portals (Employee / HR / Admin) with Supabase-style Row-Level-Security thinking baked into every screen."
              />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-primary">
                <span className="h-px w-6 bg-gold" />
                From Our People
                <span className="h-px w-6 bg-gold" />
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Trusted by faculty & HR alike.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <Card className="h-full border-border/80 shadow-sm">
                <CardContent className="flex h-full flex-col p-6">
                  <Quote className="h-7 w-7 text-gold/70" />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">
                    &ldquo;WorkHive transformed how I file my leave - what used to take three forms and a hallway walk now takes three clicks. The approval tracker alone saved my sanity during enrollment week.&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3 border-t border-border/60 pt-4">
                    <HexagonAvatar name="Ma. Cristina D. Paguyo" color="#1e40af" size={38} />
                    <div>
                      <div className="text-sm font-semibold text-foreground">Ma. Cristina D. Paguyo</div>
                      <div className="text-xs text-muted-foreground">Faculty, College of Education</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="h-full border-border/80 shadow-sm">
                <CardContent className="flex h-full flex-col p-6">
                  <Quote className="h-7 w-7 text-gold/70" />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">
                    &ldquo;Attendance records are finally transparent. My faculty can self-serve their time logs, and I can pull a clean report for payroll without chasing paper timesheets.&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3 border-t border-border/60 pt-4">
                    <HexagonAvatar name="Engr. Philip A. Oca" color="#1e40af" size={38} />
                    <div>
                      <div className="text-sm font-semibold text-foreground">Engr. Philip A. Oca</div>
                      <div className="text-xs text-muted-foreground">Department Chair, Engineering</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="h-full border-border/80 shadow-sm">
                <CardContent className="flex h-full flex-col p-6">
                  <Quote className="h-7 w-7 text-gold/70" />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">
                    &ldquo;Onboarding a new hire used to mean three Manila folders. Now every requirement lives in one profile - verified, dated, and searchable. WorkHive is the digital backbone our HR office needed.&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3 border-t border-border/60 pt-4">
                    <HexagonAvatar name="Jocelyn R. Mendoza" color="#1e40af" size={38} />
                    <div>
                      <div className="text-sm font-semibold text-foreground">Jocelyn R. Mendoza</div>
                      <div className="text-xs text-muted-foreground">HR Officer, South Campus</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
            <div className="relative overflow-hidden rounded-[28px] px-6 py-12 text-center sm:px-12 sm:py-16" style={{ background: "linear-gradient(to bottom right, #3d6af0 0%, #1f4cae 45%, #14356f 100%)" }}>
              <div className="sidebar-honeycomb absolute inset-0 opacity-25" aria-hidden />
              <div className="relative">
                <div className="flex justify-center">
                  <WorkHiveLogo size={56} light />
                </div>
                <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Ready to modernize your HR workflow?
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-white/80">
                  Sign in with your registered email account to access your dashboard, file leave, and manage your records anytime, anywhere. University email is recommended when available.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Button size="lg" onClick={() => setView("public:login")} className="bg-gold text-primary hover:bg-amber-400 hover:text-primary">
                    Employee Login <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setView("public:careers")} className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                    Browse Careers
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
      {showScrollToTop && (
        <button
          type="button"
          className="hexagon fixed bottom-6 right-6 z-50 flex h-[72px] w-16 flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-blue-700 to-blue-900 text-white drop-shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-none">Top</span>
        </button>
      )}
    </div>
  );
}

function Stat({ n, label, icon, accent, year }: { n: number; label: string; icon: React.ReactNode; accent?: boolean; year?: string }) {
  return (
    <Card className="relative h-full min-h-[170px] overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              accent ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"
            }`}
          >
            {icon}
          </div>
          <span className="pt-1 text-sm text-muted-foreground">{year ?? new Date().getFullYear()}</span>
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{n}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Feature({ icon, title, desc, accent }: { icon: React.ReactNode; title: string; desc: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-gold/40" : ""}>
      <CardContent className="p-6">
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${accent ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
        <h3 className="mb-1.5 text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function Testimonial({ quote, author, role, accent }: { quote: string; author: string; role: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-6">
      <div className="mb-3 text-gold">.....</div>
      <p className="text-sm text-primary-foreground/90">"{quote}"</p>
      <div className="mt-4">
        <div className={`text-sm font-semibold ${accent ? "text-gold" : "text-white"}`}>{author}</div>
        <div className="text-xs text-primary-foreground/60">{role}</div>
      </div>
    </div>
  );
}

function HeroHexagonCluster() {
  const features = [
    { icon: <CalendarClock className="h-5 w-5" />, label: "Attendance", color: "#1e3a8a" },
    { icon: <Plane className="h-5 w-5" />, label: "Leave", color: "#1d4ed8" },
    { icon: <Briefcase className="h-5 w-5" />, label: "Recruitment", color: "#0e7490" },
    { icon: <Users className="h-5 w-5" />, label: "Employees", color: "#f59e0b" },
    { icon: <BarChart3 className="h-5 w-5" />, label: "Reports", color: "#1e40af" },
    { icon: <Award className="h-5 w-5" />, label: "Interviews", color: "#b45309" },
    { icon: <Clock className="h-5 w-5" />, label: "Tardiness", color: "#075985" },
  ];
  return (
    <div className="relative mx-auto h-[480px] w-[480px]">
      {/* Central logo hex */}
      <div className="absolute left-1/2 top-1/2 z-10 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <WorkHiveLogo size={144} showText={false} />
      </div>
      {/* Surrounding hexagons */}
      {features.map((f, i) => {
        const angle = (i / features.length) * Math.PI * 2 - Math.PI / 2;
        const r = 180;
        const x = 240 + r * Math.cos(angle) - 50;
        const y = 240 + r * Math.sin(angle) - 57;
        return (
          <div
            key={f.label}
            className="absolute flex h-[114px] w-[100px] flex-col items-center justify-center gap-1.5 text-white shadow-lg"
            style={{
              left: x,
              top: y,
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              background: `linear-gradient(135deg, ${f.color}, ${f.color}dd)`,
            }}
          >
            {f.icon}
            <span className="text-[11px] font-semibold">{f.label}</span>
          </div>
        );
      })}
    </div>
  );
}






















"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useWorkHive } from "@/lib/store";
import { usePublicSiteStats } from "@/hooks/use-public-site-stats";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { usePublicJobPostings } from "@/hooks/use-job-postings";
import { PublicHeader, PublicFooter } from "./layout";
import { HoneycombBg } from "@/components/shared/hexagon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, MapPin, Clock, Search, ArrowRight, Building2, Users, Filter, LayoutGrid, Rows3, CalendarDays, Loader2 } from "lucide-react";
import type { JobPosting, JobQualification } from "@/lib/types";

function normalizeQualifications(job: JobPosting): JobQualification[] {
  return (job.qualifications ?? []).map((qualification) => ({
    title: qualification.title ?? "",
    description: qualification.description ?? "",
  }));
}

function toViewModel(job: JobPosting) {
  const active = typeof job.active === "boolean" ? job.active : job.status !== "Closed";

  return {
    ...job,
    active,
    summary: job.summary ?? job.description ?? "",
    qualifications: normalizeQualifications(job),
    postedAt: job.postedAt ?? job.postedDate ?? "",
    statusLabel: active ? "Active" : "Closed",
    positionTypeLabel: String(job.positionType ?? "-") || "-",
  };
}

function formatDisplayDate(date: string) {
  if (!date) {
    return "-";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CareersPage() {
  const { setView, setSelectedJobId } = useWorkHive();
  const { data } = useSystemSettings();
  const statsQuery = usePublicSiteStats();
  const jobPostingsQuery = usePublicJobPostings();
  const settings = data?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const campusAddress = settings?.campusAddress ?? "Sanciangko St., Cebu City, 6000 Cebu, Philippines";
  const stats = statsQuery.data;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "Active" | "Closed">("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "horizontal">("grid");

  const jobPostings = useMemo(() => (jobPostingsQuery.data ?? []).map(toViewModel), [jobPostingsQuery.data]);
  const departmentOptions = Array.from(new Set(jobPostings.map((job) => job.department))).sort((a, b) => a.localeCompare(b));

  const filtered = jobPostings.filter((job) => {
    const queryValue = query.trim().toLowerCase();
    const matchesQuery =
      queryValue.length === 0 ||
      job.title.toLowerCase().includes(queryValue) ||
      job.department.toLowerCase().includes(queryValue) ||
      job.summary.toLowerCase().includes(queryValue);
    const matchesFilter = filter === "all" || job.statusLabel === filter;
    const matchesDepartment = departmentFilter === "all" || job.department === departmentFilter;
    return matchesQuery && matchesFilter && matchesDepartment;
  });

  const activeJobs = stats?.activeJobPostingCount ?? jobPostings.filter((job) => job.active).length;
  const departments = stats?.departmentCount ?? new Set(jobPostings.map((job) => job.department)).size;

  return (
    <div className="relative flex min-h-screen flex-col">
      <PublicHeader />
      <HoneycombBg />
      <main className="flex-1">
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold">
                <Briefcase className="h-4 w-4" />
                Careers at {organizationName}
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Build your career with <span className="text-gold">{organizationName}</span>.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Join faculty and staff serving the {organizationName} community. Listings posted by HR are shown here live so applicants always see the latest openings.
              </p>

              <div className="mt-10 flex flex-wrap gap-6">
                <HeroStat icon={<Briefcase className="h-5 w-5" />} value={activeJobs} label="Open positions" />
                <HeroStat icon={<Building2 className="h-5 w-5" />} value={departments} label="Departments" />
                <HeroStat icon={<Users className="h-5 w-5" />} value={stats?.employeeCount ?? 0} label="Faculty members" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative max-w-sm flex-1 sm:min-w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search position or department..." className="h-12 pl-9" />
              </div>
              <div className="w-full sm:min-w-[260px]">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="relative h-12 w-full rounded-xl border-border bg-transparent pl-11 shadow-sm" aria-label="Filter by department">
                    <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="mt-1 max-h-72 rounded-xl border-border bg-card shadow-lg scroll-thin">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department} value={department}>{department}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex rounded-lg border border-border bg-card p-1 shadow-sm">
                <button onClick={() => setViewMode("grid")} className={`rounded-md px-3 py-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode("horizontal")} className={`rounded-md px-3 py-1.5 transition-colors ${viewMode === "horizontal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Horizontal view">
                  <Rows3 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
                {(["all", "Active", "Closed"] as const).map((status) => (
                  <button key={status} onClick={() => setFilter(status)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filter === status ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {status === "all" ? "All Postings" : status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {jobPostingsQuery.isLoading ? (
            <div className="mt-12 rounded-xl border border-dashed border-border py-16 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">Loading live job postings...</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((job) => (
                <Card key={job.id} className="flex flex-col transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-1 flex-col p-6">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex shrink-0">
                        <TarCareerHexIcon />
                      </div>
                      <Badge variant="outline" className={job.active ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-200 text-slate-700 hover:bg-slate-200"}>
                        {job.statusLabel}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                    <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {job.department}</div>
                      <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {job.positionTypeLabel} | Posted {formatDisplayDate(job.postedAt)}</div>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{job.summary}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{job.qualifications.length} qualifications</Badge>
                    </div>
                    <div className="mt-auto pt-4">
                      <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                        setSelectedJobId(job.id);
                        setView("public:job-detail");
                      }}>
                        View Details & Apply <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-5">
              {filtered.map((job) => (
                <Card key={job.id} className="group relative overflow-hidden border-border/80 shadow-sm transition-all hover:border-gold/40 hover:shadow-md">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                      <div className="hidden shrink-0 sm:flex">
                        <TarCareerHexIcon />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${job.active ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-slate-200 text-slate-700"}`}>
                            {job.statusLabel}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                            {job.department}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {job.positionTypeLabel}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-foreground sm:text-xl">{job.title}</h3>
                        <p className="mt-1.5 max-w-3xl line-clamp-2 text-sm text-muted-foreground">{job.summary}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {campusAddress}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-primary" />
                            Posted {formatDisplayDate(job.postedAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-primary" />
                            {job.qualifications.length} qualifications
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2 lg:flex-col lg:items-end">
                        <Button onClick={() => {
                          setSelectedJobId(job.id);
                          setView("public:job-detail");
                        }} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 lg:w-auto">
                          View Details & Apply
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!jobPostingsQuery.isLoading && filtered.length === 0 && (
            <div className="mt-12 rounded-xl border border-dashed border-border py-16 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No job postings match your search.</p>
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function TarCareerHexIcon() {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 100 100" className="absolute inset-0" aria-hidden>
        <path d="M50 4 L91 27 L91 73 L50 96 L9 73 L9 27 Z" fill="#173f8a" stroke="#f4b000" strokeWidth="3" />
      </svg>
      <Briefcase className="relative z-10 h-6 w-6 text-white" strokeWidth={1.9} />
    </div>
  );
}

function HeroStat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-gold">
        {icon}
      </div>
      <div>
        <div className="text-3xl font-bold leading-none text-foreground">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useWorkHive, useJobById } from "@/lib/store";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { PublicHeader, PublicFooter } from "./layout";
import { HoneycombBg } from "@/components/shared/hexagon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileText,
  MapPin,
  Send,
  Upload,
  type LucideIcon,
} from "lucide-react";

function formatDate(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export function JobDetailPage() {
  const { selectedJobId, setView, addApplicant } = useWorkHive();
  const { data } = useSystemSettings();
  const settings = data?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const job = useJobById(selectedJobId);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", contact: "", message: "" });

  const handleFileChange = (req: string, fileName: string) => {
    setUploads((prev) => ({ ...prev, [req]: fileName }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    setTimeout(() => {
      addApplicant({
        id: `app-${Date.now()}`,
        jobId: job?.id ?? "",
        name: form.name || "Applicant",
        email: form.email || "no-email@example.com",
        phone: form.contact,
        appliedDate: new Date().toISOString().slice(0, 10),
        stage: "New",
        requirements: (job?.requirements ?? []).map((req) => ({
          key: req,
          label: req,
          submitted: Boolean(uploads[req]),
        })),
      });

      setSubmitting(false);
      setDialogOpen(false);
      toast({
        title: "Application submitted",
        description: `Thank you, ${form.name || "applicant"}. The ${organizationName} HR team will contact you via ${form.email || "your email"} within 5-7 business days.`,
      });
      setForm({ name: "", email: "", contact: "", message: "" });
      setUploads({});
    }, 900);
  };

  if (!job) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">No position selected</h1>
            <p className="mt-2 text-muted-foreground">
              Browse our open positions and select one to view details.
            </p>
            <Button className="mt-6" onClick={() => setView("public:careers")}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Careers
            </Button>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const requirementsComplete = job.requirements.filter((req) => uploads[req]).length;

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="relative flex-1 overflow-hidden">
        <HoneycombBg />

        <section className="relative overflow-hidden">

          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
            <button
              onClick={() => setView("public:careers")}
              className="inline-flex items-center gap-1.5 text-sm text-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Careers
            </button>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="text-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                  <Badge className="bg-gold/15 text-gold hover:bg-gold/15">{job.positionType}</Badge>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">CCS - {job.department}</Badge>
                </div>

                <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  {job.title}
                </h1>
                <p className="mt-4 max-w-4xl text-lg leading-relaxed text-muted-foreground">
                  {job.description}
                </p>

                <div className="mt-6 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoTile icon={Building2} label="Department" value={job.department} />
                  <InfoTile icon={MapPin} label="Location" value={organizationName} />
                  <InfoTile icon={CalendarClock} label="Posted" value={formatDate(job.postedDate)} />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-3 sm:min-w-[200px]">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="w-full bg-gold font-semibold text-primary shadow-lg hover:bg-gold/90 hover:text-primary">
                      Apply Now
                      <Send className="ml-1 h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[min(92vw,48rem)] max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl text-primary">Apply for: {job.title}</DialogTitle>
                      <DialogDescription>
                        Complete the form below and upload the required documents. All files are routed directly to the {organizationName} HR team.
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-name">Full Name *</Label>
                          <Input id="apply-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Dela Cruz" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-email">Email Address *</Label>
                          <Input id="apply-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@example.com" />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-contact">Contact Number *</Label>
                          <Input id="apply-contact" required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="0917 123 4567" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-message">Message (optional)</Label>
                          <Input id="apply-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us briefly about yourself..." />
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-semibold">
                            Required Documents
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              ({requirementsComplete}/{job.requirements.length} uploaded)
                            </span>
                          </h4>
                        </div>
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {job.requirements.map((req) => {
                            const hasFile = Boolean(uploads[req]);
                            return (
                              <UploadRow
                                key={req}
                                label={req}
                                hasFile={hasFile}
                                fileName={uploads[req]}
                                onChange={(fileName) => handleFileChange(req, fileName)}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <DialogFooter>
                        <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                          Cancel
                        </Button>
                        <Button className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90" type="submit" disabled={submitting}>
                          {submitting ? "Submitting..." : "Submit Application"}
                          {!submitting && <Send className="ml-1 h-4 w-4" />}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  className="w-full border-border bg-background/90 text-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setView("public:careers")}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to list
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="relative">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Briefcase className="h-5 w-5" />
                      Position Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="leading-relaxed text-muted-foreground">{job.description}</p>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <FileText className="h-5 w-5" />
                      Application Requirements Checklist
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                      The following {job.requirements.length} documents must be prepared before submitting your application. Click <span className="font-semibold text-primary">Apply Now</span> to upload them.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {job.requirements.map((req) => (
                        <div key={req} className="flex items-start gap-2.5 rounded-md border border-border/60 bg-background p-2.5 transition-colors hover:border-gold/40">
                          <HexCheck />
                          <span className="text-sm leading-snug text-foreground/90">{req}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <aside className="space-y-5">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-primary">Position Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <SummaryRow icon={Building2} label="Department" value={job.department} />
                    <SummaryRow icon={Briefcase} label="Employment Type" value={job.positionType} />
                    <SummaryRow icon={MapPin} label="Location" value={organizationName} />
                    <SummaryRow icon={CalendarClock} label="Date Posted" value={formatDate(job.postedDate)} />
                    <SummaryRow icon={FileText} label="Requirements" value={`${job.requirements.length} documents`} />
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/5 to-gold/10 shadow-sm">
                  <CardContent className="p-5 text-center">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-gold bg-primary text-white">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-primary">Ready to apply?</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prepare all required documents, then submit your application.
                    </p>
                    <Button onClick={() => setDialogOpen(true)} className="mt-4 w-full bg-primary text-white hover:bg-primary/90">
                      Apply Now
                      <Send className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card/90 px-3 py-2.5 shadow-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="break-words text-sm font-medium text-foreground/90">{value}</div>
      </div>
    </div>
  );
}

function HexCheck() {
  return (
    <div className="relative shrink-0" style={{ width: 22, height: 22 }}>
      <svg width={22} height={22} viewBox="0 0 100 100" aria-hidden>
        <path d="M50 4 L91 27 L91 73 L50 96 L9 73 L9 27 Z" fill="var(--primary)" stroke="var(--gold)" strokeWidth="4" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
      </div>
    </div>
  );
}

function UploadRow({
  label,
  hasFile,
  fileName,
  onChange,
}: {
  label: string;
  hasFile: boolean;
  fileName?: string;
  onChange: (fileName: string) => void;
}) {
  const inputId = `upload-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  return (
    <label
      htmlFor={inputId}
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2.5 transition-colors ${
        hasFile
          ? "border-emerald-300 bg-emerald-50"
          : "border-dashed border-border hover:border-gold/50 hover:bg-muted/50"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${hasFile ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
          {hasFile ? <CheckCircle2 className="h-4 w-4" /> : <Upload className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className="truncate text-xs text-muted-foreground">{hasFile ? fileName : "Click to upload file"}</div>
        </div>
      </div>
      <input
        id={inputId}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f.name);
        }}
      />
    </label>
  );
}







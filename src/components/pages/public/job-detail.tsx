"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useWorkHive } from "@/lib/store";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { usePublicJobPosting } from "@/hooks/use-job-postings";
import { useApplicantTemplate } from "@/hooks/use-applicant-template";
import { PublicHeader, PublicFooter } from "./layout";
import { HoneycombBg } from "@/components/shared/hexagon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { APPLICATION_REQUIREMENT_ACCEPT, APPLICATION_REQUIREMENT_MAX_MB } from "@/lib/employee-document-config";
import { APPLICANT_REQUIREMENT_GROUPS, APPLICANT_UPLOAD_REQUIREMENTS, GOVERNMENT_STATUTORY_NUMBER_FIELDS } from "@/lib/application-requirements";
import { AlertCircle, ArrowLeft, Briefcase, Building2, CalendarClock, CheckCircle2, FileCheck2, FileText, Loader2, MapPin, Send, Upload, type LucideIcon } from "lucide-react";
import type { Applicant, JobPosting, JobQualification } from "@/lib/types";

type ApplyFormState = {
  name: string;
  email: string;
  contact: string;
  message: string;
  sssNumber: string;
  tinNumber: string;
  pagIbigNumber: string;
  philHealthNumber: string;
};

type RequirementUploadState = Record<string, File[]>;

const EMPTY_FORM: ApplyFormState = {
  name: "",
  email: "",
  contact: "",
  message: "",
  sssNumber: "",
  tinNumber: "",
  pagIbigNumber: "",
  philHealthNumber: "",
};

function createEmptyUploadState(): RequirementUploadState {
  return Object.fromEntries(APPLICANT_UPLOAD_REQUIREMENTS.map((requirement) => [requirement.key, []]));
}

function formatDate(date: string): string {
  if (!date) {
    return "-";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeQualifications(job: JobPosting): JobQualification[] {
  return (job.qualifications ?? []).map((qualification) => ({
    title: qualification.title ?? "",
    description: qualification.description ?? "",
  }));
}

function isApplyFormComplete(form: ApplyFormState) {
  return Boolean(
    form.name.trim() &&
    form.email.trim() &&
    form.contact.trim() &&
    form.sssNumber.trim() &&
    form.tinNumber.trim() &&
    form.pagIbigNumber.trim() &&
    form.philHealthNumber.trim(),
  );
}

export function JobDetailPage() {
  const { selectedJobId, setView, addApplicant } = useWorkHive();
  const { data } = useSystemSettings();
  const jobQuery = usePublicJobPosting(selectedJobId);
  const applicantTemplateQuery = useApplicantTemplate();
  const settings = data?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ApplyFormState>(EMPTY_FORM);
  const [uploadedRequirements, setUploadedRequirements] = useState<RequirementUploadState>(() => createEmptyUploadState());

  const job = jobQuery.data
    ? {
        ...jobQuery.data,
        active: typeof jobQuery.data.active === "boolean" ? jobQuery.data.active : jobQuery.data.status !== "Closed",
        summary: jobQuery.data.summary ?? jobQuery.data.description ?? "",
        qualifications: normalizeQualifications(jobQuery.data),
        postedAt: jobQuery.data.postedAt ?? jobQuery.data.postedDate ?? "",
        positionTypeLabel: String(jobQuery.data.positionType ?? "-") || "-",
      }
    : null;

  const uploadedCount = APPLICANT_UPLOAD_REQUIREMENTS.filter((requirement) => (uploadedRequirements[requirement.key] ?? []).length > 0).length;
  const applicantTemplate = applicantTemplateQuery.data?.template;
  const allRequirementsUploaded = uploadedCount === APPLICANT_UPLOAD_REQUIREMENTS.length;
  const canSubmit = Boolean(job?.active) && isApplyFormComplete(form) && allRequirementsUploaded && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!job || !job.active || !canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      const payload = new FormData();
      payload.set("jobId", job.id);
      payload.set("fullName", form.name.trim());
      payload.set("email", form.email.trim());
      payload.set("contact", form.contact.trim());
      payload.set("message", form.message.trim());
      payload.set("sssNumber", form.sssNumber.trim());
      payload.set("tinNumber", form.tinNumber.trim());
      payload.set("pagIbigNumber", form.pagIbigNumber.trim());
      payload.set("philHealthNumber", form.philHealthNumber.trim());

      APPLICANT_UPLOAD_REQUIREMENTS.forEach((requirement) => {
        const files = uploadedRequirements[requirement.key] ?? [];
        files.forEach((file) => {
          payload.append(`requirement:${requirement.key}`, file);
        });
      });

      const response = await fetch("/api/public/applications", {
        method: "POST",
        body: payload,
      });

      const body = await response.json() as { applicant?: Applicant; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to submit the application.");
      }

      if (body.applicant) {
        addApplicant(body.applicant);
      }

      setSubmitting(false);
      setDialogOpen(false);
      toast({
        title: "Application submitted",
        description: `Thank you, ${form.name}. Your application package was submitted successfully for ${job.title}.`,
      });
      setForm(EMPTY_FORM);
      setUploadedRequirements(createEmptyUploadState());
    } catch (error) {
      setSubmitting(false);
      toast({
        title: "Unable to submit application",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  function handleRequirementUpload(requirementKey: string, fileList: FileList | null) {
    setUploadedRequirements((current) => ({
      ...current,
      [requirementKey]: Array.from(fileList ?? []),
    }));
  }

  if (!selectedJobId) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">No position selected</h1>
            <p className="mt-2 text-muted-foreground">Browse our open positions and select one to view details.</p>
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

  if (jobQuery.isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading job details...</p>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Job posting not found</h1>
            <p className="mt-2 text-muted-foreground">This listing may have been removed or changed.</p>
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

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="relative flex-1 overflow-hidden">
        <HoneycombBg />
        <section className="relative overflow-hidden">
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
            <button onClick={() => setView("public:careers")} className="inline-flex items-center gap-1.5 text-sm text-foreground transition-colors hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              Back to Careers
            </button>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="text-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={job.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>
                    {job.active ? "Active" : "Closed"}
                  </Badge>
                  <Badge className="bg-gold/15 text-gold hover:bg-gold/15">{job.positionTypeLabel}</Badge>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{job.department}</Badge>
                </div>

                <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{job.title}</h1>
                <p className="mt-4 max-w-4xl text-lg leading-relaxed text-muted-foreground">{job.summary}</p>
              </div>

              <div className="flex min-w-0 flex-col gap-3 sm:min-w-[220px]">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" disabled={!job.active} className="w-full bg-gold font-semibold text-primary shadow-lg hover:bg-gold/90 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                      {job.active ? "Apply Now" : "Posting Closed"}
                      {job.active ? <Send className="ml-1 h-4 w-4" /> : null}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[min(95vw,62rem)] max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl text-primary">Apply for: {job.title}</DialogTitle>
                      <DialogDescription>
                        Enter your applicant details, statutory numbers, downloadable form templates, and all required uploads before submission.
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-name">Full Name *</Label>
                          <Input id="apply-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Juan Dela Cruz" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-email">Email Address *</Label>
                          <Input id="apply-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="juan@example.com" />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-contact">Contact Number *</Label>
                          <Input id="apply-contact" required value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="0917 123 4567" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="apply-message">Message (optional)</Label>
                          <Input id="apply-message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Tell us briefly about yourself..." />
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold text-primary">Government Statutory Numbers</h3>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {GOVERNMENT_STATUTORY_NUMBER_FIELDS.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <Label htmlFor={field.key}>{field.label} Number *</Label>
                              <Input
                                id={field.key}
                                required
                                value={form[field.key]}
                                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                                placeholder={`Enter ${field.label} number`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-background p-4">
                        {applicantTemplate?.storagePath ? (
                          <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 p-3">
                            <p className="text-sm font-semibold text-primary">UC Application Form Template</p>
                            <p className="mt-1 text-xs text-muted-foreground">Download the latest UC Application Form here, fill it out, then upload it in the first requirement slot below.</p>
                            <a href="/api/public/applicant-template/download" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-primary hover:text-primary/80 hover:underline">Download UC Application Form</a>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-primary">Requirements Uploader</h3>
                            <p className="text-xs text-muted-foreground">All {APPLICANT_UPLOAD_REQUIREMENTS.length} requirement items are required. Some document types can accept multiple files and everything will be bundled into one ZIP after submission.</p>
                          </div>
                          <Badge className={allRequirementsUploaded ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                            {uploadedCount}/{APPLICANT_UPLOAD_REQUIREMENTS.length} uploaded
                          </Badge>
                        </div>

                        <div className="mt-4 space-y-3">
                          {APPLICANT_UPLOAD_REQUIREMENTS.map((requirement, index) => {
                            const files = uploadedRequirements[requirement.key] ?? [];
                            const inputId = `upload-${requirement.key}`;

                            return (
                              <div key={requirement.key} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                                      <span className="text-primary">{String(index + 1).padStart(2, "0")}</span>
                                      <span>{requirement.label}</span>
                                    </div>
                                    {requirement.key === "application-letter" ? <p className="mt-1 text-sm font-medium text-muted-foreground">See full text on job profile.</p> : null}
                                    {requirement.templateKey && applicantTemplate?.storagePath ? (
                                      <a href="/api/public/applicant-template/download" target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm font-medium text-primary hover:text-primary/80 hover:underline">Download template</a>
                                    ) : null}

                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {files.length > 0
                                        ? files.length === 1
                                          ? `Selected: ${files[0].name}`
                                          : `Selected: ${files.length} files`
                                        : `${requirement.allowMultiple ? "Upload one or more files." : "Upload one file."} Accepted formats: PDF, JPG, JPEG, PNG up to ${APPLICATION_REQUIREMENT_MAX_MB} MB each`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {files.length > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                                    <Input id={inputId} type="file" multiple={Boolean(requirement.allowMultiple)} accept={APPLICATION_REQUIREMENT_ACCEPT} onChange={(event) => handleRequirementUpload(requirement.key, event.target.files)} className="max-w-xs" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
                        <Button className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90" type="submit" disabled={!canSubmit}>
                          {submitting ? "Submitting..." : "Submit Application"}
                          {!submitting && job.active ? <Send className="ml-1 h-4 w-4" /> : null}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" className="w-full border-border bg-background/90 text-foreground hover:bg-accent hover:text-foreground" onClick={() => setView("public:careers")}>
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
                    <p className="leading-relaxed text-muted-foreground">{job.summary}</p>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <FileText className="h-5 w-5" />
                      Qualifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                      The following {job.qualifications.length} qualifications describe the requirements for this job posting.
                    </p>
                    <div className="space-y-3">
                      {job.qualifications.map((qualification, index) => (
                        <div key={`${qualification.title}-${index}`} className="flex items-start gap-3 rounded-md border border-border/60 bg-background p-3 transition-colors hover:border-gold/40">
                          <HexCheck />
                          <div>
                            <div className="text-sm font-semibold text-foreground/90">{qualification.title.trim() || `Qualification ${index + 1}`}</div>
                            <p className="mt-1 text-sm leading-snug text-muted-foreground">{qualification.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <FileText className="h-5 w-5" />
                      Requirements List
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Applicants must encode the four statutory numbers in the form and upload all requirement items listed below.
                    </p>
                    {APPLICANT_REQUIREMENT_GROUPS.map((group) => (
                      <div key={group.title} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-primary">{group.title}</h4>
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                            {group.uploadRequired ? "Upload Required" : "Form Field"}
                          </Badge>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {group.items.map((item) => (
                            <li key={item.key} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{item.key === "application-letter" ? "Application Letter addressed to: Atty. Augusto W. Go (University Chairman) through: Ms. Remelie T. Bongcawil (HR Generalist)" : item.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
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
                    <SummaryRow icon={Briefcase} label="Employment Type" value={job.positionTypeLabel} />
                    <SummaryRow icon={MapPin} label="Location" value={organizationName} />
                    <SummaryRow icon={CalendarClock} label="Date Posted" value={formatDate(job.postedAt)} />
                    <SummaryRow icon={FileText} label="Qualifications" value={`${job.qualifications.length} required`} />
                    <SummaryRow icon={Upload} label="Upload Pack" value={`${APPLICANT_UPLOAD_REQUIREMENTS.length} requirement items`} />
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/5 to-gold/10 shadow-sm">
                  <CardContent className="p-5 text-center">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-gold bg-primary text-white">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-primary">{job.active ? "Ready to apply?" : "This posting is closed"}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.active ? "Prepare the required forms, supporting documents, and your statutory numbers, then submit one validated application package." : "You can still review the role details, but applications are no longer being accepted."}
                    </p>
                    <Button onClick={() => setDialogOpen(true)} disabled={!job.active} className="mt-4 w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                      {job.active ? "Apply Now" : "Posting Closed"}
                      {job.active ? <Send className="ml-1 h-4 w-4" /> : null}
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


























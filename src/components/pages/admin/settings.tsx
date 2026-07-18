"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  GraduationCap,
  Clock,
  AlertTriangle,
  CalendarClock,
  MapPin,
  Save,
  School,
  Phone,
  Mail,
  MapPinned,
  ChevronRight,
  CheckCircle2,
  Database,
  ShieldCheck,
  Loader2,
  Plane,
  CircleAlert,
  KeyRound,
  Upload,
  Download,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWorkHive } from "@/lib/store";
import { HexagonBadge } from "@/components/shared/hexagon";
import { useAdminSystemSettings } from "@/hooks/use-system-settings";
import { useAdminApplicantTemplate } from "@/hooks/use-applicant-template";
import type { SystemSettingsApiResponse, SystemSettingsHealth, SystemSettingsRecord } from "@/lib/admin-types";
import { buildAcademicYearOptions, DEFAULT_SYSTEM_SETTINGS, normalizeAcademicYear } from "@/lib/system-settings";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "@/lib/role-default-passwords";
import { APPLICANT_TEMPLATE_ACCEPT } from "@/lib/employee-document-config";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"] as const;
const DEFAULT_HEALTH: SystemSettingsHealth = {
  schemaMigrated: false,
  databaseConnected: false,
};

type AddressSearchResult = {
  placeId: string;
  name: string;
  formattedAddress: string;
};
function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeTrim(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberOrFallback(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSettings(settings: SystemSettingsRecord): SystemSettingsRecord {
  return {
    organizationName: safeTrim(settings.organizationName, DEFAULT_SYSTEM_SETTINGS.organizationName),
    campusAddress: safeTrim(settings.campusAddress, DEFAULT_SYSTEM_SETTINGS.campusAddress),
    campusLandmark: safeTrim(settings.campusLandmark, DEFAULT_SYSTEM_SETTINGS.campusLandmark),
    campusPlaceId: safeTrim(settings.campusPlaceId, DEFAULT_SYSTEM_SETTINGS.campusPlaceId),
    contactNumber: safeTrim(settings.contactNumber, DEFAULT_SYSTEM_SETTINGS.contactNumber),
    hrEmail: safeTrim(settings.hrEmail, DEFAULT_SYSTEM_SETTINGS.hrEmail),
    academicYear: normalizeAcademicYear(safeTrim(settings.academicYear, DEFAULT_SYSTEM_SETTINGS.academicYear)),
    currentSemester: safeTrim(settings.currentSemester, DEFAULT_SYSTEM_SETTINGS.currentSemester),
    gracePeriod: clampNumber(numberOrFallback(settings.gracePeriod, DEFAULT_SYSTEM_SETTINGS.gracePeriod), 0, 60),
    tardinessThreshold: clampNumber(numberOrFallback(settings.tardinessThreshold, DEFAULT_SYSTEM_SETTINGS.tardinessThreshold), 1, 20),
    holidayReminderLead: clampNumber(numberOrFallback(settings.holidayReminderLead, DEFAULT_SYSTEM_SETTINGS.holidayReminderLead), 1, 30),
    vacationLeaveDays: clampNumber(numberOrFallback(settings.vacationLeaveDays, DEFAULT_SYSTEM_SETTINGS.vacationLeaveDays), 0, 365),
    sickLeaveDays: clampNumber(numberOrFallback(settings.sickLeaveDays, DEFAULT_SYSTEM_SETTINGS.sickLeaveDays), 0, 365),
    incentiveLeaveDays: clampNumber(numberOrFallback(settings.incentiveLeaveDays, DEFAULT_SYSTEM_SETTINGS.incentiveLeaveDays), 0, 365),
    soloParentLeaveDays: clampNumber(numberOrFallback(settings.soloParentLeaveDays, DEFAULT_SYSTEM_SETTINGS.soloParentLeaveDays), 0, 365),
    paternityLeaveDays: clampNumber(numberOrFallback(settings.paternityLeaveDays, DEFAULT_SYSTEM_SETTINGS.paternityLeaveDays), 0, 365),
    maternityLeaveDays: clampNumber(numberOrFallback(settings.maternityLeaveDays, DEFAULT_SYSTEM_SETTINGS.maternityLeaveDays), 0, 365),
    leaveWithoutPayDays: clampNumber(numberOrFallback(settings.leaveWithoutPayDays, DEFAULT_SYSTEM_SETTINGS.leaveWithoutPayDays), 0, 365),
    employeeDefaultPassword: safeTrim(settings.employeeDefaultPassword, DEFAULT_SYSTEM_SETTINGS.employeeDefaultPassword),
    hrDefaultPassword: safeTrim(settings.hrDefaultPassword, DEFAULT_SYSTEM_SETTINGS.hrDefaultPassword),
    adminDefaultPassword: safeTrim(settings.adminDefaultPassword, DEFAULT_SYSTEM_SETTINGS.adminDefaultPassword),
    updatedAt: settings.updatedAt,
  };
}

function settingsEqual(left: SystemSettingsRecord, right: SystemSettingsRecord) {
  const normalizedLeft = normalizeSettings(left);
  const normalizedRight = normalizeSettings(right);

  return (
    normalizedLeft.organizationName === normalizedRight.organizationName &&
    normalizedLeft.campusAddress === normalizedRight.campusAddress &&
    normalizedLeft.campusLandmark === normalizedRight.campusLandmark &&
    normalizedLeft.campusPlaceId === normalizedRight.campusPlaceId &&
    normalizedLeft.contactNumber === normalizedRight.contactNumber &&
    normalizedLeft.hrEmail === normalizedRight.hrEmail &&
    normalizedLeft.academicYear === normalizedRight.academicYear &&
    normalizedLeft.currentSemester === normalizedRight.currentSemester &&
    normalizedLeft.gracePeriod === normalizedRight.gracePeriod &&
    normalizedLeft.tardinessThreshold === normalizedRight.tardinessThreshold &&
    normalizedLeft.holidayReminderLead === normalizedRight.holidayReminderLead &&
    normalizedLeft.vacationLeaveDays === normalizedRight.vacationLeaveDays &&
    normalizedLeft.sickLeaveDays === normalizedRight.sickLeaveDays &&
    normalizedLeft.incentiveLeaveDays === normalizedRight.incentiveLeaveDays &&
    normalizedLeft.soloParentLeaveDays === normalizedRight.soloParentLeaveDays &&
    normalizedLeft.paternityLeaveDays === normalizedRight.paternityLeaveDays &&
    normalizedLeft.maternityLeaveDays === normalizedRight.maternityLeaveDays &&
    normalizedLeft.leaveWithoutPayDays === normalizedRight.leaveWithoutPayDays &&
    normalizedLeft.employeeDefaultPassword === normalizedRight.employeeDefaultPassword &&
    normalizedLeft.hrDefaultPassword === normalizedRight.hrDefaultPassword &&
    normalizedLeft.adminDefaultPassword === normalizedRight.adminDefaultPassword
  );
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setView } = useWorkHive();
  const { data, isLoading, error } = useAdminSystemSettings();
  const applicantTemplateQuery = useAdminApplicantTemplate();

  const [savedSettings, setSavedSettings] = useState<SystemSettingsRecord>(DEFAULT_SYSTEM_SETTINGS);
  const [form, setForm] = useState<SystemSettingsRecord>(DEFAULT_SYSTEM_SETTINGS);
  const [applicantTemplateFile, setApplicantTemplateFile] = useState<File | null>(null);
  const [addressResults, setAddressResults] = useState<AddressSearchResult[]>([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [hasAddressSearchInput, setHasAddressSearchInput] = useState(false);
  const skipNextAddressSearchRef = useRef(false);

  useEffect(() => {
    if (!data?.settings) {
      return;
    }

    let cancelled = false;
    const normalized = normalizeSettings(data.settings);

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setHasAddressSearchInput(false);
      setSavedSettings(normalized);
      setForm(normalized);
    });

    return () => {
      cancelled = true;
    };
  }, [data?.settings]);

  useEffect(() => {
    if (skipNextAddressSearchRef.current) {
      skipNextAddressSearchRef.current = false;
      queueMicrotask(() => {
        setAddressResults([]);
        setAddressSearchError(null);
        setAddressSearchLoading(false);
      });
      return;
    }

    if (!hasAddressSearchInput) {
      queueMicrotask(() => {
        setAddressResults([]);
        setAddressSearchError(null);
        setAddressSearchLoading(false);
      });
      return;
    }

    const term = form.campusAddress.trim();
    if (term.length < 3) {
      queueMicrotask(() => {
        setAddressResults([]);
        setAddressSearchError(null);
        setAddressSearchLoading(false);
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setAddressSearchLoading(true);
      setAddressSearchError(null);

      try {
        const response = await fetch(`/api/google-maps/address-search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as { results?: AddressSearchResult[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to search Google Maps.");
        }

        setAddressResults(payload.results ?? []);
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") {
          return;
        }

        setAddressResults([]);
        setAddressSearchError(searchError instanceof Error ? searchError.message : "Unable to search Google Maps.");
      } finally {
        setAddressSearchLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [form.campusAddress, hasAddressSearchInput]);

  const health = data?.health ?? DEFAULT_HEALTH;
  const academicYearOptions = useMemo(() => buildAcademicYearOptions(form.academicYear), [form.academicYear]);
  const dirty = useMemo(() => !settingsEqual(form, savedSettings), [form, savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (nextSettings: SystemSettingsRecord) => {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeSettings(nextSettings)),
      });

      const payload = (await response.json()) as SystemSettingsApiResponse & { error?: string };
      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? "Unable to save settings.");
      }

      return payload;
    },
    onSuccess: (payload) => {
      const normalized = normalizeSettings(payload.settings);
      setSavedSettings(normalized);
      setForm(normalized);
      queryClient.setQueryData(["admin-settings"], payload);
      queryClient.setQueryData(["system-settings"], { settings: normalized });
      void queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast({
        title: "All changes saved",
        description: "System settings were saved successfully.",
      });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to save settings",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });


  const applicantTemplateUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const payload = new FormData();
      payload.set("templateFile", file);

      const response = await fetch("/api/admin/settings/applicant-template", {
        method: "POST",
        body: payload,
      });

      const rawBody = await response.text();
      const body = rawBody ? JSON.parse(rawBody) as { error?: string } : {};
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to upload the applicant template.");
      }
    },
    onSuccess: () => {
      setApplicantTemplateFile(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-applicant-template"] });
      void queryClient.invalidateQueries({ queryKey: ["public-applicant-template"] });
      toast({
        title: "Template uploaded",
        description: "Applicants can now download the latest UC Application Form from the public application page.",
      });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to upload template",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateField = <K extends keyof SystemSettingsRecord>(key: K, value: SystemSettingsRecord[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateNumberField = (key: "gracePeriod" | "tardinessThreshold" | "holidayReminderLead" | "vacationLeaveDays" | "sickLeaveDays" | "incentiveLeaveDays" | "soloParentLeaveDays" | "paternityLeaveDays" | "maternityLeaveDays" | "leaveWithoutPayDays", value: string) => {
    const fallback = savedSettings[key] ?? DEFAULT_SYSTEM_SETTINGS[key];
    updateField(key, toNumber(value, fallback) as SystemSettingsRecord[typeof key]);
  };

  const handleAddressPick = (result: AddressSearchResult) => {
    setHasAddressSearchInput(false);
    skipNextAddressSearchRef.current = true;
    setForm((current) => ({
      ...current,
      campusAddress: result.formattedAddress,
      campusLandmark: result.name.trim(),
      campusPlaceId: result.placeId.trim(),
    }));
    setAddressResults([]);
    setAddressSearchError(null);
    toast({
      title: "Address captured",
      description: `Saved ${result.name} as the private map landmark while showing ${result.formattedAddress} in the address field.`,
    });
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync(form);
  };

  const handleReset = () => {
    setHasAddressSearchInput(false);
    setForm(savedSettings);
    setAddressResults([]);
    setAddressSearchError(null);
    toast({
      title: "Changes reset",
      description: "Form values were restored to the last saved settings.",
    });
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading system settings...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Unable to load system settings."}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
            {dirty && (
              <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Unsaved changes
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Configure organization-wide parameters for the WorkHive HRMS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HexagonBadge color="#0e7490">
            <ShieldCheck className="mr-1 h-3 w-3" /> Admin only
          </HexagonBadge>
          <HexagonBadge color="#1e3a8a">{form.organizationName}</HexagonBadge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { icon: Building2, label: "Organization", desc: "Campus identity", target: "org" },
          { icon: GraduationCap, label: "Academic Calendar", desc: "Year & semester", target: "calendar" },
          { icon: Clock, label: "Attendance Policies", desc: "Grace & tardiness", target: "attendance" },
          { icon: Plane, label: "Leave Limits", desc: "Max leave days", target: "leave-limits" },
          { icon: CalendarClock, label: "Reminders & GPS", desc: "Lead time & zones", target: "reminders" },
          { icon: KeyRound, label: "Default Passwords", desc: "Role-based access", target: "passwords" },
        ].map((section) => (
          <a
            key={section.target}
            href={`#${section.target}`}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <section.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{section.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{section.desc}</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </a>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="org" className="scroll-mt-20">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>Primary campus identity used across all modules.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <School className="h-3.5 w-3.5 text-muted-foreground" /> Campus Name
              </Label>
              <Input value={form.organizationName} onChange={(event) => updateField("organizationName", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Address
              </Label>
              <div className="relative z-20">
                <div className="relative">
                  <Input
                    value={form.campusAddress}
                    onChange={(event) => {
                      setHasAddressSearchInput(true);
                      setForm((current) => ({
                        ...current,
                        campusAddress: event.target.value,
                        campusLandmark: "",
                        campusPlaceId: "",
                      }));
                    }}
                    placeholder="Search campus, building, or landmark"
                    className="pr-10"
                  />
                  {addressSearchLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Search here to find a campus or landmark, then pick a Google Maps result to save its formatted address and keep its exact landmark privately for GPS zones.
                </p>
                {addressSearchError && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-destructive/20 bg-card px-3 py-2 text-[11px] text-destructive shadow-lg">
                    {addressSearchError}
                  </div>
                )}
                {!addressSearchError && hasAddressSearchInput && form.campusAddress.trim().length >= 3 && !addressSearchLoading && addressResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground shadow-lg">
                    No Google Maps matches found for this search.
                  </div>
                )}
                {addressResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {addressResults.map((result) => (
                      <button
                        key={result.placeId}
                        type="button"
                        onClick={() => handleAddressPick(result)}
                        className="flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-primary/5 last:border-b-0"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{result.name}</p>
                          <p className="text-xs text-muted-foreground">{result.formattedAddress}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Contact Number
                </Label>
                <Input value={form.contactNumber} onChange={(event) => updateField("contactNumber", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> HR Email
                </Label>
                <Input value={form.hrEmail} onChange={(event) => updateField("hrEmail", event.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Single-campus deployment - updates here immediately feed the shared website branding and contact details after save.
            </div>
            <Separator />
            <div className="space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4 text-primary" /> UC Application Form Template
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Upload the official UC Application Form here so applicants can download the latest template before submitting their files.</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">UC Application Form</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {applicantTemplateFile
                        ? `Selected: ${applicantTemplateFile.name}`
                        : applicantTemplateQuery.data?.template.fileName?.trim()
                          ? `Current file: ${applicantTemplateQuery.data.template.fileName}`
                          : "No template uploaded yet."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input type="file" accept={APPLICANT_TEMPLATE_ACCEPT} className="max-w-xs" onChange={(event) => setApplicantTemplateFile(event.target.files?.[0] ?? null)} />
                    <div className="flex gap-2">
                      {applicantTemplateQuery.data?.template.storagePath ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                          <a href="/api/public/applicant-template/download" target="_blank" rel="noreferrer">
                            <Download className="mr-1 h-3.5 w-3.5" /> Download
                          </a>
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" disabled>
                          <Download className="mr-1 h-3.5 w-3.5" /> Download
                        </Button>
                      )}
                      <Button type="button" size="sm" disabled={!applicantTemplateFile || applicantTemplateUploadMutation.isPending} onClick={() => { if (applicantTemplateFile) { applicantTemplateUploadMutation.mutate(applicantTemplateFile); } }}>
                        {applicantTemplateUploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {applicantTemplateUploadMutation.isPending ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        <Card id="calendar" className="scroll-mt-20">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Academic Calendar</CardTitle>
                <CardDescription>Drives payroll cutoffs, leave windows and reporting.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Academic Year</Label>
              <Select value={normalizeAcademicYear(form.academicYear)} onValueChange={(value) => updateField("academicYear", value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {academicYearOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Current Semester</Label>
              <Select value={form.currentSemester} onValueChange={(value) => updateField("currentSemester", value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEMESTER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-gold/5">
              <div className="flex items-center justify-between p-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Active Period</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {form.currentSemester} <span className="text-muted-foreground">-</span> {normalizeAcademicYear(form.academicYear)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <GraduationCap className="h-6 w-6" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="attendance" className="scroll-mt-20">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Attendance Policies</CardTitle>
                <CardDescription>Thresholds applied to daily time records.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Grace Period
                </Label>
                <span className="text-xs font-semibold text-primary">{form.gracePeriod} min</span>
              </div>
              <Input type="number" min={0} max={60} value={form.gracePeriod} onChange={(event) => updateNumberField("gracePeriod", event.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Employees who time in within this many minutes after scheduled start are not flagged late.
              </p>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-gold" /> Tardiness Threshold
                </Label>
                <span className="text-xs font-semibold text-gold">{form.tardinessThreshold} lates</span>
              </div>
              <Input type="number" min={1} max={20} value={form.tardinessThreshold} onChange={(event) => updateNumberField("tardinessThreshold", event.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Lates within a cutoff period that triggers a <span className="font-medium text-gold">Habitual Tardiness</span> tag.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-center">
                <p className="text-base font-bold text-primary">{form.gracePeriod}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Grace (min)</p>
              </div>
              <div className="rounded-lg border border-gold/30 bg-gold/5 p-2.5 text-center">
                <p className="text-base font-bold text-gold">{form.tardinessThreshold}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Habitual at</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="leave-limits" className="scroll-mt-20">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plane className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Leave Limits</CardTitle>
                <CardDescription>Maximum allowed days per leave type used across leave filing.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { key: "vacationLeaveDays", label: "Vacation Leave", value: form.vacationLeaveDays },
                { key: "sickLeaveDays", label: "Sick Leave", value: form.sickLeaveDays },
                { key: "incentiveLeaveDays", label: "Summer Incentive Leave (College of Nursing only)", value: form.incentiveLeaveDays },
                { key: "soloParentLeaveDays", label: "Solo Parent Leave", value: form.soloParentLeaveDays },
                { key: "paternityLeaveDays", label: "Paternity Leave", value: form.paternityLeaveDays },
                { key: "maternityLeaveDays", label: "Maternity Leave", value: form.maternityLeaveDays },
              ].map((leave) => (
                <div key={leave.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{leave.label}</Label>
                    <span className="text-xs font-semibold text-primary">{leave.value} day{leave.value === 1 ? "" : "s"}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={leave.value}
                    onChange={(event) => updateNumberField(leave.key as "vacationLeaveDays" | "sickLeaveDays" | "incentiveLeaveDays" | "soloParentLeaveDays" | "paternityLeaveDays" | "maternityLeaveDays" | "leaveWithoutPayDays", event.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Leave W/O Pay is unlimited by default and no longer needs a maximum setting.</p>

          </CardContent>
        </Card>

        <Card id="reminders" className="scroll-mt-20">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Reminders & Geofencing</CardTitle>
                <CardDescription>Notifications and location-based attendance.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> Holiday Reminder Lead Time
                </Label>
                <span className="text-xs font-semibold text-primary">{form.holidayReminderLead} days</span>
              </div>
              <Input type="number" min={1} max={30} value={form.holidayReminderLead} onChange={(event) => updateNumberField("holidayReminderLead", event.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Automated reminder emails are scheduled {form.holidayReminderLead} day{form.holidayReminderLead === 1 ? "" : "s"} before each upcoming holiday.
              </p>
            </div>
            <Separator />
            <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
              <div className="flex items-start gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">GPS Attendance Zones</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Configure geofence zones. Attendance only registers if the detected location matches an admin-defined zone.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2.5" onClick={() => setView("admin:gps-zones")}>
                    <MapPin className="mr-1 h-3.5 w-3.5" /> Manage GPS Zones
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="passwords" className="scroll-mt-20">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Role Default Passwords</CardTitle>
                <CardDescription>Control the default login password used when accounts are created per role.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Employee Default Password</Label>
                <Input
                  value={form.employeeDefaultPassword}
                  onChange={(event) => updateField("employeeDefaultPassword", event.target.value)}
                  placeholder="UCSemployee@123"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">HR Default Password</Label>
                <Input
                  value={form.hrDefaultPassword}
                  onChange={(event) => updateField("hrDefaultPassword", event.target.value)}
                  placeholder="UCShr@123"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Admin Default Password</Label>
                <Input
                  value={form.adminDefaultPassword}
                  onChange={(event) => updateField("adminDefaultPassword", event.target.value)}
                  placeholder="UCSadmin@123"
                />
              </div>
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
              Changing a role default password affects newly created accounts immediately. Existing users only rotate to the new password while they are still marked as using the system default for that role. Once a user requests their own password reset, that account is treated as custom and is skipped from future auto-updates. {PASSWORD_REQUIREMENTS_MESSAGE}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-foreground">WorkHive HRMS v1.0.0</span>
            <span>-</span>
            <span>Settings apply to all modules</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className={`flex items-center gap-1.5 ${health.schemaMigrated ? "text-emerald-600" : "text-muted-foreground"}`}>
              {health.schemaMigrated ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />} Schema migrated
            </span>
            <span className={`flex items-center gap-1.5 ${health.databaseConnected ? "text-emerald-600" : "text-muted-foreground"}`}>
              {health.databaseConnected ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />} Backups enabled
            </span>
          </div>
        </CardContent>
      </Card>

      <div className={`sticky bottom-4 z-20 flex items-center justify-end gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur transition-all ${dirty ? "border-gold/40" : ""}`}>
        <p className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {dirty ? (
            <><span className="h-1.5 w-1.5 rounded-full bg-gold" /> You have unsaved changes</>
          ) : (
            <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> All changes saved</>
          )}
        </p>
        <Button variant="outline" onClick={handleReset} disabled={!dirty || saveMutation.isPending}>Reset</Button>
        <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}


























"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Employee,
  EducationTier,
  EmploymentStatus,
  DEPARTMENTS,
  DocumentRecord,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { HexagonAvatar } from "@/components/shared/hexagon";
import {
  employmentStatusColor,
  formatDate,
  lengthOfService,
} from "@/components/shared/helpers";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil,
  Check,
  X,
  GraduationCap,
  FileText,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Shield,
  Loader2,
} from "lucide-react";

const TIERS: EducationTier["level"][] = ["Bachelor", "Master", "Doctoral"];
const EMP_STATUSES: EmploymentStatus[] = [
  "Regular",
  "Probationary",
  "Retired",
  "Resigned",
];

type EmployeeProfile = Employee & { birthDate?: string };

type EmployeeProfileResponse = {
  employee?: EmployeeProfile;
  error?: string;
};

function documentStatusClass(status: DocumentRecord["status"]) {
  if (status === "Verified") {
    return "border-green-500/40 text-green-600 dark:text-green-400";
  }
  if (status === "Rejected") {
    return "border-red-500/40 text-red-600 dark:text-red-400";
  }
  return "border-amber-500/40 text-amber-600 dark:text-amber-400";
}

async function readProfileResponse(response: Response) {
  const payload = (await response.json()) as EmployeeProfileResponse;
  if (!response.ok || !payload.employee) {
    throw new Error(payload.error ?? "Unable to load your profile.");
  }
  return payload.employee;
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) {
    return null;
  }

  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EmployeeProfile | null>(null);

  const profileQuery = useQuery({
    queryKey: ["employee-profile"],
    queryFn: async () => {
      const response = await fetch("/api/employee/profile", { cache: "no-store" });
      return readProfileResponse(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const employee = profileQuery.data ?? null;
  const current = editing ? draft ?? employee : employee;

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<EmployeeProfile>) => {
      const response = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readProfileResponse(response);
    },
    onSuccess: (updatedEmployee) => {
      queryClient.setQueryData(["employee-profile"], updatedEmployee);
      setDraft(updatedEmployee);
      setEditing(false);
      toast({
        title: "Profile updated",
        description: "Your personal information has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update profile",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (profileQuery.isLoading) {
    return (
      <div className="p-6 text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading your employee profile...
      </div>
    );
  }

  if (profileQuery.error) {
    return (
      <div className="p-6 text-muted-foreground">
        {profileQuery.error instanceof Error ? profileQuery.error.message : "No employee record found."}
      </div>
    );
  }

  if (!employee || !current) {
    return <div className="p-6 text-muted-foreground">No employee record found.</div>;
  }

  const set = <K extends keyof EmployeeProfile>(key: K, value: EmployeeProfile[K]) =>
    setDraft((currentDraft) => ({ ...(currentDraft ?? employee), [key]: value }));

  const handleSave = () => {
    if (!draft) {
      return;
    }

    saveMutation.mutate({
      lastName: draft.lastName,
      firstName: draft.firstName,
      middleName: draft.middleName,
      email: draft.email,
      address: draft.address,
      contactNumber: draft.contactNumber,
      position: draft.position,
      department: draft.department,
      dateHired: draft.dateHired,
      employmentStatus: draft.employmentStatus,
      documents: draft.documents,
    });
  };

  const handleCancel = () => {
    setDraft(employee);
    setEditing(false);
  };

  const startEditing = () => {
    setDraft(employee);
    setEditing(true);
  };

  const los = lengthOfService(employee.dateHired);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <HexagonAvatar name={`${employee.firstName} ${employee.lastName}`} color={employee.avatarColor ?? "#1e3a8a"} size={64} />
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">{employee.firstName} {employee.middleName} {employee.lastName}</h2>
                <p className="text-sm text-muted-foreground">{employee.position} - {employee.department}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" style={{ color: employmentStatusColor(employee.employmentStatus), borderColor: employmentStatusColor(employee.employmentStatus) }}>
                    {employee.employmentStatus}
                  </Badge>
                  <Badge variant="secondary">{employee.idNumber?.trim() || "-"}</Badge>
                  <span className="text-xs text-muted-foreground">{los} of service</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={handleCancel} disabled={saveMutation.isPending}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Changes
                  </Button>
                </>
              ) : (
                <Button onClick={startEditing} disabled={saveMutation.isPending}>
                  <Pencil className="h-4 w-4" /> Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Update your contact details and employment information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Last Name" icon={<Shield className="h-3.5 w-3.5" />}><Input value={current.lastName} disabled={!editing} onChange={(e) => set("lastName", e.target.value)} /></Field>
            <Field label="First Name" icon={<Shield className="h-3.5 w-3.5" />}><Input value={current.firstName} disabled={!editing} onChange={(e) => set("firstName", e.target.value)} /></Field>
            <Field label="Middle Name"><Input value={current.middleName} disabled={!editing} onChange={(e) => set("middleName", e.target.value)} /></Field>
            <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />}><Input type="email" value={current.email} disabled={!editing} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Contact Number" icon={<Phone className="h-3.5 w-3.5" />}><Input value={current.contactNumber} disabled={!editing} onChange={(e) => set("contactNumber", e.target.value)} /></Field>
            <Field label="Address" icon={<MapPin className="h-3.5 w-3.5" />}><Input value={current.address} disabled={!editing} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="Position" icon={<Briefcase className="h-3.5 w-3.5" />}><Input value={current.position} disabled={!editing} onChange={(e) => set("position", e.target.value)} /></Field>
            <Field label="Department">
              <Select value={current.department} onValueChange={(v) => set("department", v)} disabled={!editing}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Date Hired" icon={<Calendar className="h-3.5 w-3.5" />}><Input type="date" value={current.dateHired} disabled={!editing} onChange={(e) => set("dateHired", e.target.value)} /></Field>
            <Field label="Employment Status">
              <Select value={current.employmentStatus} onValueChange={(v) => set("employmentStatus", v as EmploymentStatus)} disabled={!editing}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{EMP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Gender"><Input value={current.gender} disabled /></Field>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4 text-primary" /> Education</CardTitle>
            <CardDescription>Academic background on file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {TIERS.map((tier) => {
              const edu = employee.education.filter((entry) => entry.level === tier);
              return (
                <div key={tier} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{tier}</p>
                  {edu.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No record on file.</p>
                  ) : (
                    edu.map((entry, index) => (
                      <div key={index} className="mt-2">
                        <p className="text-sm font-medium text-foreground">{entry.degree}</p>
                        <p className="text-xs text-muted-foreground">{entry.school}{entry.year ? ` - ${entry.year}` : ""}</p>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Certificates & Documents</CardTitle>
          <CardDescription>Diplomas, licenses, and certifications already uploaded to your record.</CardDescription>
        </CardHeader>
        <CardContent>
          {employee.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {employee.documents.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}</Label>
      {children}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentRecord }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex h-28 items-center justify-center bg-muted/40">
        <FileText className="h-10 w-10 text-muted-foreground/60" />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{doc.fileName}</p>
          <Badge variant="outline" className={documentStatusClass(doc.status)}>{doc.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{doc.label ?? doc.type}</p>
        <Separator className="my-2" />
        <p className="text-[10px] text-muted-foreground">Uploaded {formatDate(doc.uploadDate)}{doc.sizeBytes ? ` - ${formatFileSize(doc.sizeBytes)}` : ""}</p>
      </div>
    </div>
  );
}

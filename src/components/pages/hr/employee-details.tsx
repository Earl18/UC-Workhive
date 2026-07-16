"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkHive } from "@/lib/store";
import { useHrEmployee } from "@/hooks/use-hr-master-list";
import type { DocumentRecord, Employee, EmploymentStatus } from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { calculateAgeFromBirthDate, employmentStatusColor, formatDate, lengthOfService } from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  FileText,
  Calendar,
  Loader2,
  CheckCircle2,
  Ban,
} from "lucide-react";

const STATUS_OPTIONS: EmploymentStatus[] = ["Regular", "Probationary", "Retired", "Resigned"];

type HrMasterListCache = {
  employees: Array<Employee & { birthDate?: string }>;
  departments: string[];
  positions: string[];
};

function normalizeDateInputValue(value: string) {
  const text = value.trim();
  if (!text) {
    return "";
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const [, month, day, rawYear] = usMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

async function patchEmployee(id: string, payload: Partial<Employee & { birthDate?: string }>) {
  const response = await fetch(`/api/hr/master-list/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<{ employee: Employee & { birthDate?: string } }>(response);
}

async function patchEmployeeDocumentStatus(id: string, docId: string, status: DocumentRecord["status"]) {
  const response = await fetch(`/api/hr/master-list/${id}/documents/${docId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return readJson<{ employee: Employee & { birthDate?: string } }>(response);
}

function documentStatusClass(status: DocumentRecord["status"]) {
  if (status === "Verified") {
    return "border-green-500/40 text-green-600 dark:text-green-400";
  }
  if (status === "Rejected") {
    return "border-red-500/40 text-red-600 dark:text-red-400";
  }
  return "border-amber-500/40 text-amber-600 dark:text-amber-400";
}

export function EmployeeDetailsPage() {
  const queryClient = useQueryClient();
  const { selectedEmployeeId, setView } = useWorkHive();
  const { toast } = useToast();
  const { data, isLoading, error } = useHrEmployee(selectedEmployeeId);
  const employee = data?.employee ?? null;

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<(Employee & { birthDate?: string }) | null>(null);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Employee & { birthDate?: string }>) => patchEmployee(selectedEmployeeId!, payload),
    onSuccess: ({ employee: updated }) => {
      queryClient.setQueryData(["hr-master-list", selectedEmployeeId], { employee: updated });
      queryClient.setQueryData(["hr-master-list"], (current: HrMasterListCache | undefined) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          employees: current.employees.map((employeeRecord) => (
            employeeRecord.id === updated.id ? { ...employeeRecord, ...updated } : employeeRecord
          )),
        };
      });
      void queryClient.invalidateQueries({ queryKey: ["hr-master-list"], refetchType: "inactive" });
      toast({ title: "Profile Updated", description: `${updated.lastName}, ${updated.firstName}` });
      setEditMode(false);
      setDraft(updated);
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to save employee",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const documentStatusMutation = useMutation({
    mutationFn: ({ docId, status }: { docId: string; status: DocumentRecord["status"] }) => patchEmployeeDocumentStatus(selectedEmployeeId!, docId, status),
    onSuccess: ({ employee: updated }) => {
      queryClient.setQueryData(["hr-master-list", selectedEmployeeId], { employee: updated });
      queryClient.setQueryData(["hr-master-list"], (current: HrMasterListCache | undefined) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          employees: current.employees.map((employeeRecord) => (
            employeeRecord.id === updated.id ? { ...employeeRecord, ...updated } : employeeRecord
          )),
        };
      });
      void queryClient.invalidateQueries({ queryKey: ["hr-master-list"], refetchType: "inactive" });
      toast({ title: "Document status updated", description: `${updated.lastName}, ${updated.firstName}` });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to update document status",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!selectedEmployeeId) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setView("hr:master-list")} className="text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Master List
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">No employee selected.</p>
            <Button className="mt-4" onClick={() => setView("hr:master-list")}>
              Pick from Master List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setView("hr:master-list")} className="text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Master List
        </Button>
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading employee profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setView("hr:master-list")} className="text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Master List
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">{error instanceof Error ? error.message : "Employee record not found."}</p>
            <Button className="mt-4" onClick={() => setView("hr:master-list")}>Return to Master List</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = editMode && draft ? draft : employee;
  const currentLengthOfService = lengthOfService(current.dateHired);
  const currentAge = calculateAgeFromBirthDate(current.birthDate);

  function startEdit() {
    setDraft({ ...employee });
    setEditMode(true);
  }

  function cancelEdit() {
    setDraft({ ...employee });
    setEditMode(false);
  }

  function saveEdit() {
    if (!draft) {
      return;
    }
    saveMutation.mutate(draft);
  }

  function patchDraft(patch: Partial<Employee & { birthDate?: string }>) {
    setDraft((currentDraft) => (currentDraft ? { ...currentDraft, ...patch } : currentDraft));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setView("hr:master-list")} className="text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Master List
        </Button>
        {editMode ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEdit} disabled={saveMutation.isPending}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={saveEdit} className="bg-green-600 hover:bg-green-700" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Changes
            </Button>
          </div>
        ) : (
          <Button onClick={startEdit}><Pencil className="mr-1 h-4 w-4" /> Edit Profile</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <HexagonAvatar name={`${current.firstName} ${current.lastName}`} color={current.avatarColor || "#1e3a8a"} size={72} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-primary">{current.lastName}, {current.firstName} {current.middleName}</h1>
                <HexagonBadge color={employmentStatusColor(current.employmentStatus)}>{current.employmentStatus}</HexagonBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{current.position} - {current.department}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span><Calendar className="mr-1 inline h-3 w-3" /> Hired {formatDate(current.dateHired)}</span>
                <span>Length of Service: <strong className="text-foreground">{currentLengthOfService}</strong></span>
                <span>Age: <strong className="text-foreground">{currentAge ?? "-"}</strong></span>
                <span>ID Number: <strong className="text-foreground">{current.idNumber?.trim() || "-"}</strong></span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-primary">Personal & Employment Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Last Name" editMode={editMode} value={current.lastName} onChange={(value) => patchDraft({ lastName: value })} />
              <Field label="First Name" editMode={editMode} value={current.firstName} onChange={(value) => patchDraft({ firstName: value })} />
              <Field label="Middle Name" editMode={editMode} value={current.middleName} onChange={(value) => patchDraft({ middleName: value })} />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Gender</Label>
                {editMode ? (
                  <Select value={draft!.gender} onValueChange={(value) => patchDraft({ gender: value as Employee["gender"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                  </Select>
                ) : <p className="text-sm font-medium">{current.gender}</p>}
              </div>
              <Field label="Department" editMode={editMode} value={current.department} onChange={(value) => patchDraft({ department: value })} />
              <Field label="Position" editMode={editMode} value={current.position} onChange={(value) => patchDraft({ position: value })} />
              <Field label="Date Hired" editMode={editMode} type="date" value={current.dateHired} onChange={(value) => patchDraft({ dateHired: value })} />
              <Field label="Birth Date" editMode={editMode} type="date" value={current.birthDate ?? ""} onChange={(value) => patchDraft({ birthDate: value })} />
              <Field label="Length of Service" editMode={false} value={currentLengthOfService} onChange={() => undefined} />
              <Field label="Age" editMode={false} value={currentAge?.toString() ?? ""} onChange={() => undefined} />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Employment Status</Label>
                {editMode ? (
                  <Select value={draft!.employmentStatus} onValueChange={(value) => patchDraft({ employmentStatus: value as EmploymentStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <HexagonBadge color={employmentStatusColor(current.employmentStatus)}>{current.employmentStatus}</HexagonBadge>}
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" editMode={editMode} value={current.email} onChange={(value) => patchDraft({ email: value })} icon={<Mail className="h-4 w-4" />} />
              <Field label="Contact Number" editMode={editMode} value={current.contactNumber} onChange={(value) => patchDraft({ contactNumber: value })} icon={<Phone className="h-4 w-4" />} />
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Address</Label>
                {editMode ? (
                  <Textarea value={draft!.address} onChange={(event) => patchDraft({ address: event.target.value })} rows={2} />
                ) : (
                  <p className="flex items-start gap-2 text-sm font-medium"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /> {current.address}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-primary"><GraduationCap className="h-4 w-4" /> Education</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[26rem] space-y-3 overflow-y-auto scroll-thin pt-0">
            {current.education.length === 0 && <p className="text-sm text-muted-foreground">No education records.</p>}
            {current.education.map((education, index) => (
              <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-primary/40 text-primary">{education.level}</Badge>
                  {education.year && <span className="text-xs text-muted-foreground">{education.year}</span>}
                </div>
                <p className="mt-2 text-sm font-medium">{education.degree}</p>
                <p className="text-xs text-muted-foreground">{education.school}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-primary"><FileText className="h-4 w-4" /> Documents & Certificates</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {current.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {current.documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{document.fileName}</p>
                          <p className="text-xs text-muted-foreground">{document.label ?? document.type} - {formatDate(document.uploadDate)}</p>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={documentStatusClass(document.status)}>{document.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => documentStatusMutation.mutate({ docId: document.id, status: "Verified" })} disabled={documentStatusMutation.isPending || document.status === "Verified"}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Verify
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => documentStatusMutation.mutate({ docId: document.id, status: "Rejected" })} disabled={documentStatusMutation.isPending || document.status === "Rejected"}>
                      <Ban className="mr-1 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  editMode,
  onChange,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  editMode: boolean;
  onChange: (value: string) => void;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editMode ? (
        <Input type={type} value={type === "date" ? normalizeDateInputValue(value) : value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <p className="flex items-center gap-2 text-sm font-medium">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {type === "date" ? (value ? formatDate(value) : "-") : (value || "-")}
        </p>
      )}
    </div>
  );
}

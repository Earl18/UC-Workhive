"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Search,
  Upload,
  ArrowUpDown,
  Filter,
  Loader2,
  Briefcase,
  Building2,
  CircleUserRound,
  CalendarDays,
  GraduationCap,
  Download,
  FileSpreadsheet,
  UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHrMasterList } from "@/hooks/use-hr-master-list";
import { useWorkHive } from "@/lib/store";
import type { Employee, EmploymentStatus, StaffCategory } from "@/lib/types";
import type { ImportedEmployeeDraft } from "@/lib/hr-import";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { calculateAgeFromBirthDate, employmentStatusColor, formatDate, lengthOfService } from "@/components/shared/helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type MasterListEmployee = Employee & { birthDate?: string };
type MasterListEmployeeWithAge = MasterListEmployee & { parsedAge: number | null };
type SortKey = "idNumber" | "lastName" | "firstName" | "department" | "position" | "dateHired" | "employmentStatus" | "age";
type AgeFilter = "all" | "under-25" | "25-34" | "35-44" | "45-54" | "55-plus";
type EducationLevelFilter = "all" | "Bachelor" | "Master" | "Doctoral";

type ImportPreviewPayload = {
  duplicates: {
    duplicateFileIdNumbers: string[];
    duplicateFileEmails: string[];
    duplicateFileFullNames: string[];
    existingDbIdNumbers: string[];
    existingDbEmails: string[];
    existingDbFullNames: string[];
    existingDbIdNumberConflicts: string[];
    existingDbEmployeeIdConflicts: string[];
    uniqueRecordCount: number;
    matchedDbRecordCount: number;
    matchRows: Array<{
      imported: {
        idNumber: string;
        fullName: string;
        email: string;
        department: string;
        position: string;
        dateHired: string;
        employmentStatus: string;
      };
      existing: {
        id: string;
        idNumber: string | null;
        fullName: string;
        email: string;
        department: string;
        position: string;
        dateHired: string;
        employmentStatus: string;
      };
      matchedBy: "ID Number" | "Email" | "Full Name" | "First + Last Name" | "ID Number + Name" | "Email + Full Name" | "ID Number Conflict";
      conflictLabel?: "ID Number Already Used" | "Employee Already Has Different ID Number";
    }>;
  };
  fileName: string;
  sheetName: string;
  classification: string;
  staffCategory: StaffCategory;
  workbookType?: "employee-information" | "id-number";
  workbookTypeLabel?: string;
  workbookTypeReason?: string;
  records: ImportedEmployeeDraft[];
};

const STATUS_OPTIONS: Array<"All" | EmploymentStatus> = ["All", "Regular", "Probationary", "Retired", "Resigned"];
const GENDER_OPTIONS = ["All", "Male", "Female"] as const;
const AGE_OPTIONS: Array<{ value: AgeFilter; label: string }> = [
  { value: "all", label: "All Ages" },
  { value: "under-25", label: "Under 25" },
  { value: "25-34", label: "25 - 34" },
  { value: "35-44", label: "35 - 44" },
  { value: "45-54", label: "45 - 54" },
  { value: "55-plus", label: "55+" },
];
const EDUCATION_LEVEL_OPTIONS: Array<{ value: EducationLevelFilter; label: string }> = [
  { value: "all", label: "All Education" },
  { value: "Bachelor", label: "Bachelor" },
  { value: "Master", label: "Master" },
  { value: "Doctoral", label: "Doctoral" },
];

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

async function readCommitJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let payload: (T & { error?: string; message?: string }) | null = null;

  if (raw) {
    try {
      payload = JSON.parse(raw) as T & { error?: string; message?: string };
    } catch {
      if (!response.ok) {
        throw new Error(raw);
      }
      throw new Error("The server returned an invalid response.");
    }
  }

  if (!response.ok) {
    throw new Error((payload?.error ?? payload?.message ?? raw) || "Request failed.");
  }

  if (!payload) {
    throw new Error("The server returned an empty response.");
  }

  return payload;
}

async function previewImport(file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/hr/master-list/import/preview", {
    method: "POST",
    body: formData,
    signal,
  });
  return readJson<ImportPreviewPayload>(response);
}

async function exportMasterListWorkbook(payload: {
  classification: string;
  filters: {
    search?: string;
    status?: string;
    department?: string;
    position?: string;
    gender?: string;
    age?: string;
    sortKey?: string;
    sortDir?: "asc" | "desc";
  };
}) {
  const response = await fetch("/api/hr/master-list/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classification: payload.classification,
      filters: payload.filters,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unable to export employee master list." }));
    throw new Error(payload.error ?? "Unable to export employee master list.");
  }

  return response.blob();
}
async function commitImport({ payload, overwriteExisting, signal }: { payload: ImportPreviewPayload; overwriteExisting: boolean; signal?: AbortSignal }) {
  const response = await fetch("/api/hr/master-list/import/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: payload.fileName,
      classification: payload.classification,
      records: payload.records,
      workbookType: payload.workbookType ?? "employee-information",
      overwriteExisting,
    }),
    signal,
  });
  return readCommitJson<{ result: { created: number; updated: number; skipped: number; total: number; accountsCreated: number; accountsSkipped: number } }>(response);
}

function educationValueFor(record: ImportedEmployeeDraft, level: "Bachelor" | "Master" | "Doctoral") {
  return record.education.find((item) => item.level === level)?.degree ?? "-";
}

export function MasterListPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setSelectedEmployeeId, setView, sidebarCollapsed } = useWorkHive();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false);
  const [importStage, setImportStage] = useState<"idle" | "uploading" | "extracting" | "saving">("idle");
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewTableRef = useRef<HTMLTableElement | null>(null);
  const duplicateScrollRef = useRef<HTMLDivElement | null>(null);
  const duplicateBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const duplicateTableRef = useRef<HTMLTableElement | null>(null);
  const [duplicateTableWidth, setDuplicateTableWidth] = useState(1680);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<(typeof GENDER_OPTIONS)[number]>("All");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [educationLevelFilter, setEducationLevelFilter] = useState<EducationLevelFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastName");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data, isLoading, error } = useHrMasterList({
    search: deferredSearch || undefined,
    status: statusFilter === "All" ? undefined : statusFilter,
    department: departmentFilter === "all" ? undefined : departmentFilter,
    position: positionFilter === "all" ? undefined : positionFilter,
    gender: genderFilter === "All" ? undefined : genderFilter,
    age: ageFilter === "all" ? undefined : ageFilter,
    educationLevel: educationLevelFilter === "all" ? undefined : educationLevelFilter,
    sortKey,
    sortDir: sortAsc ? "asc" : "desc",
    page,
    pageSize,
  });

  const employeesWithAge = useMemo<MasterListEmployeeWithAge[]>(() => {
    return (data?.employees ?? []).map((employee) => ({
      ...employee,
      parsedAge: calculateAgeFromBirthDate(employee.birthDate),
    }));
  }, [data?.employees]);

  const departments = data?.departments ?? [];
  const positions = data?.positions ?? [];

  function syncDuplicateHorizontalScroll(source: "table" | "bottom") {
    const tableScroll = duplicateScrollRef.current;
    const bottomScroll = duplicateBottomScrollRef.current;
    if (!tableScroll || !bottomScroll) {
      return;
    }

    if (source === "table") {
      if (bottomScroll.scrollLeft !== tableScroll.scrollLeft) {
        bottomScroll.scrollLeft = tableScroll.scrollLeft;
      }
      return;
    }

    if (tableScroll.scrollLeft !== bottomScroll.scrollLeft) {
      tableScroll.scrollLeft = bottomScroll.scrollLeft;
    }
  }

  useEffect(() => {
    const table = duplicateTableRef.current;
    const tableScroll = duplicateScrollRef.current;
    const bottomScroll = duplicateBottomScrollRef.current;
    if (!table || !tableScroll || !bottomScroll) {
      return;
    }

    const syncWidths = () => {
      const nextWidth = Math.max(table.scrollWidth, tableScroll.scrollWidth, 1680);
      setDuplicateTableWidth(nextWidth);
      if (bottomScroll.scrollLeft !== tableScroll.scrollLeft) {
        bottomScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };

    syncWidths();
    const frame = window.requestAnimationFrame(syncWidths);
    const observer = new ResizeObserver(syncWidths);
    observer.observe(table);
    observer.observe(tableScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [preview?.duplicates.matchRows.length]);

  function clearImportPendingState() {
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
    }
    importAbortRef.current = null;
    setImportStage("idle");
  }

  const previewMutation = useMutation({
    mutationFn: ({ file, signal }: { file: File; signal?: AbortSignal }) => previewImport(file, signal),
    onSuccess: (payload) => {
      clearImportPendingState();
      setPreview(payload);
      toast({
        title: "Extraction complete",
        description: `${payload.records.length} rows were extracted from ${payload.fileName}. ${payload.duplicates.duplicateFileIdNumbers.length + payload.duplicates.duplicateFileEmails.length + payload.duplicates.duplicateFileFullNames.length + payload.duplicates.existingDbIdNumbers.length + payload.duplicates.existingDbEmails.length + payload.duplicates.existingDbFullNames.length > 0 ? "Duplicate review needed before import." : "No duplicate ID numbers, emails, or full names were found."}`,
      });
    },
    onError: (mutationError) => {
      const aborted = mutationError instanceof Error && mutationError.name === "AbortError";
      clearImportPendingState();
      if (aborted) {
        toast({
          title: "Import canceled",
          description: "The workbook upload and extraction were canceled.",
        });
        return;
      }
      toast({
        title: "Unable to extract workbook",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: commitImport,
    onSuccess: async ({ result }) => {
      clearImportPendingState();
      await queryClient.invalidateQueries({ queryKey: ["hr-master-list"] });
      await queryClient.refetchQueries({ queryKey: ["hr-master-list"], type: "active" });
      toast({
        title: "Employee masterlist updated",
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.accountsCreated} website accounts created, ${result.accountsSkipped} account creations skipped, ${result.total} total reviewed.`,
      });
      setImportOpen(false);
      setSelectedFile(null);
      setPreview(null);
      setOverwriteDuplicates(false);
    },
    onError: (mutationError) => {
      const aborted = mutationError instanceof Error && mutationError.name === "AbortError";
      clearImportPendingState();
      if (aborted) {
        toast({
          title: "Import canceled",
          description: "The import save request was canceled.",
        });
        return;
      }
      toast({
        title: "Unable to save imported records",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortAsc((current) => !current);
      setPage(1);
      return;
    }
    setSortKey(nextKey);
    setSortAsc(true);
  }

  function openRow(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setView("hr:employee-details");
  }

  async function handleExport() {
    if (typeof window === "undefined" || employeesWithAge.length === 0 || isExporting) {
      return;
    }

    try {
      setIsExporting(true);
      const blob = await exportMasterListWorkbook({
        classification: "Administrative / Non-Teaching",
        filters: {
          search: deferredSearch || undefined,
          status: statusFilter === "All" ? undefined : statusFilter,
          department: departmentFilter === "all" ? undefined : departmentFilter,
          position: positionFilter === "all" ? undefined : positionFilter,
          gender: genderFilter === "All" ? undefined : genderFilter,
          age: ageFilter === "all" ? undefined : ageFilter,
          educationLevel: educationLevelFilter === "all" ? undefined : educationLevelFilter,
          sortKey,
          sortDir: sortAsc ? "asc" : "desc",
        },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `employee-master-list-${stamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Exported",
        description: `${data?.pagination.filteredRecords ?? 0} filtered employee records were exported to Excel (.xlsx).`,
      });
    } catch (error) {
      toast({
        title: "Unable to export employee master list",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  function openImportDialog() {
    setImportOpen(true);
  }

  function closeImportDialog() {
    if (importAbortRef.current) {
      importAbortRef.current.abort();
    }
    clearImportPendingState();
    setImportOpen(false);
    setSelectedFile(null);
    setPreview(null);
    setOverwriteDuplicates(false);
  }

  function selectFile(file: File | null) {
    setSelectedFile(file);
    setPreview(null);
    setOverwriteDuplicates(false);
  }

  function startPreview() {
    if (!selectedFile) {
      toast({ title: "Excel file required", description: "Choose the non-teaching workbook first.", variant: "destructive" });
      return;
    }
    const controller = new AbortController();
    importAbortRef.current = controller;
    setImportStage("uploading");
    stageTimerRef.current = setTimeout(() => setImportStage("extracting"), 900);
    launchTimerRef.current = setTimeout(() => {
      previewMutation.mutate({ file: selectedFile, signal: controller.signal });
    }, 50);
  }

  const isIdNumberPreview = preview?.workbookType === "id-number";

  const hasDuplicateWarnings = !!preview && (
    isIdNumberPreview
      ? preview.duplicates.duplicateFileIdNumbers.length > 0
        || preview.duplicates.existingDbIdNumberConflicts.length > 0
        || preview.duplicates.existingDbEmployeeIdConflicts.length > 0
      : preview.duplicates.duplicateFileIdNumbers.length > 0
        || preview.duplicates.duplicateFileEmails.length > 0
        || preview.duplicates.duplicateFileFullNames.length > 0
        || preview.duplicates.existingDbIdNumbers.length > 0
        || preview.duplicates.existingDbEmails.length > 0
        || preview.duplicates.existingDbFullNames.length > 0
  );

  const hasDatabaseDuplicates = !!preview && (
    isIdNumberPreview
      ? preview.duplicates.existingDbIdNumberConflicts.length > 0 || preview.duplicates.existingDbEmployeeIdConflicts.length > 0
      : preview.duplicates.existingDbIdNumbers.length > 0
        || preview.duplicates.existingDbEmails.length > 0
        || preview.duplicates.existingDbFullNames.length > 0
  );

  const previewRecords = useMemo(() => preview?.records ?? [], [preview]);
  function confirmImport(overwriteExisting = overwriteDuplicates) {
    if (!preview) {
      return;
    }
    const controller = new AbortController();
    importAbortRef.current = controller;
    setOverwriteDuplicates(overwriteExisting);
    setImportStage("saving");
    launchTimerRef.current = setTimeout(() => {
      commitMutation.mutate({ payload: preview, overwriteExisting, signal: controller.signal });
    }, 50);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Employee Master List</h1>
            <p className="text-sm text-muted-foreground">
              Monitoring report of employment status - UC South Campus
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setView("hr:add-employee")}>
              <UserPlus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isExporting || employeesWithAge.length === 0}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} {isExporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button onClick={openImportDialog} className="bg-primary">
              <Upload className="mr-2 h-4 w-4" /> Import from Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-0">
            <div className="space-y-4 pt-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_auto] lg:items-end">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                      placeholder="Search name, email, department, or position..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <Badge variant="outline" className="h-10 border-primary/40 px-4 text-primary">
                  {data?.pagination.filteredRecords ?? 0} of {data?.pagination.totalRecords ?? 0} employees
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <FilterSelect
                  label="Status"
                  icon={<Filter className="h-3.5 w-3.5" />}
                  value={statusFilter}
                  onValueChange={(value) => { setStatusFilter(value as (typeof STATUS_OPTIONS)[number]); setPage(1); }}
                  options={STATUS_OPTIONS.map((value) => ({ value, label: value === "All" ? "All Statuses" : value }))}
                />
                <SearchableFilterSelect
                  label="Department"
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  value={departmentFilter}
                  onValueChange={(value) => { setDepartmentFilter(value); setPage(1); }}
                  options={[{ value: "all", label: "All Departments" }, ...departments.map((value) => ({ value, label: value }))]}
                  searchPlaceholder="Search department..."
                  emptyLabel="No department found."
                />
                <SearchableFilterSelect
                  label="Position"
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  value={positionFilter}
                  onValueChange={(value) => { setPositionFilter(value); setPage(1); }}
                  options={[{ value: "all", label: "All Positions" }, ...positions.map((value) => ({ value, label: value }))]}
                  searchPlaceholder="Search position..."
                  emptyLabel="No position found."
                />
                <FilterSelect
                  label="Gender"
                  icon={<CircleUserRound className="h-3.5 w-3.5" />}
                  value={genderFilter}
                  onValueChange={(value) => { setGenderFilter(value as (typeof GENDER_OPTIONS)[number]); setPage(1); }}
                  options={GENDER_OPTIONS.map((value) => ({ value, label: value === "All" ? "All Genders" : value }))}
                />
                <FilterSelect
                  label="Age"
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  value={ageFilter}
                  onValueChange={(value) => { setAgeFilter(value as AgeFilter); setPage(1); }}
                  options={AGE_OPTIONS}
                />
                <FilterSelect
                  label="Education"
                  icon={<GraduationCap className="h-3.5 w-3.5" />}
                  value={educationLevelFilter}
                  onValueChange={(value) => { setEducationLevelFilter(value as EducationLevelFilter); setPage(1); }}
                  options={EDUCATION_LEVEL_OPTIONS}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading employee records...
              </div>
            ) : error ? (
              <div className="py-14 text-center text-sm text-destructive">
                {error instanceof Error ? error.message : "Unable to load employee master list."}
              </div>
            ) : (
              <div className="max-h-[34rem] overflow-auto scroll-thin">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className={cn(isIdNumberPreview ? "w-[180px]" : "min-w-[120px]")}>ID Number</TableHead>
                      <SortableHead label="Last Name" k="lastName" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                      <SortableHead label="First Name" k="firstName" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                      <TableHead>Middle Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <SortableHead label="Department" k="department" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                      <SortableHead label="Position" k="position" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                      <SortableHead label="Date Hired" k="dateHired" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                      <TableHead>Length of Service</TableHead>
                      <SortableHead label="Age" k="age" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                      <SortableHead label="E-Status" k="employmentStatus" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeesWithAge.map((employee, index) => (
                      <TableRow
                        key={employee.id}
                        className="cursor-pointer hover:bg-primary/5"
                        onClick={() => openRow(employee.id)}
                      >
                        <TableCell>{employee.idNumber?.trim() || "-"}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <HexagonAvatar
                              name={`${employee.firstName} ${employee.lastName}`}
                              color={employee.avatarColor || "#1e3a8a"}
                              size={26}
                            />
                            {employee.lastName}
                          </div>
                        </TableCell>
                        <TableCell>{employee.firstName}</TableCell>
                        <TableCell>{employee.middleName || "-"}</TableCell>
                        <TableCell>{employee.gender}</TableCell>
                        <TableCell className="text-xs">{employee.department}</TableCell>
                        <TableCell className="text-xs">{employee.position}</TableCell>
                        <TableCell className="text-xs">{formatDate(employee.dateHired)}</TableCell>
                        <TableCell className="text-xs">{lengthOfService(employee.dateHired)}</TableCell>
                        <TableCell className="text-xs">{employee.parsedAge ?? "-"}</TableCell>
                        <TableCell>
                          <HexagonBadge color={employmentStatusColor(employee.employmentStatus)}>
                            {employee.employmentStatus}
                          </HexagonBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {employeesWithAge.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                          No employees match the current filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {employeesWithAge.length === 0 ? 0 : (page - 1) * (data?.pagination.pageSize ?? pageSize) + 1}
                -{Math.min(page * (data?.pagination.pageSize ?? pageSize), data?.pagination.filteredRecords ?? 0)} of {data?.pagination.filteredRecords ?? 0} filtered records
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Rows</Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={(data?.pagination.page ?? 1) <= 1}>Previous</Button>
                  <div className="min-w-[110px] text-center text-sm text-muted-foreground">Page {data?.pagination.page ?? 1} of {data?.pagination.totalPages ?? 1}</div>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(data?.pagination.totalPages ?? current, current + 1))} disabled={(data?.pagination.page ?? 1) >= (data?.pagination.totalPages ?? 1)}>Next</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) closeImportDialog(); }}>
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className={cn(
          "flex flex-col overflow-hidden p-0",
          sidebarCollapsed ? "lg:left-[calc(50%+36px)]" : "lg:left-[calc(50%+128px)]",
          preview
            ? cn(
                "h-[92vh] w-[98vw] !max-w-[88rem] sm:!max-w-[88rem]",
                sidebarCollapsed ? "lg:w-[calc(100vw-8rem)]" : "lg:w-[calc(100vw-20rem)]",
              )
            : "max-h-[90vh] w-[min(92vw,34rem)] !max-w-[34rem] sm:!max-w-[34rem]"
        )}>
          <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", preview ? "h-full" : "max-h-[90vh]")}>
            {(previewMutation.isPending || commitMutation.isPending) ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/78 backdrop-blur-[2px]">
                <div className="w-full max-w-md px-6 text-center">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                  <p className="mt-4 text-sm font-semibold text-foreground">
                    {commitMutation.isPending
                      ? "Saving imported employee records..."
                      : importStage === "uploading"
                        ? "Uploading workbook..."
                        : "Extracting employee data..."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {commitMutation.isPending
                      ? "Please wait while the finalized list is written to the database and new employee website accounts are provisioned."
                      : "Please keep this window open while we prepare the preview."}
                  </p>
                  <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-primary/12">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            ) : null}
            <div className={cn("min-h-0 p-6", preview ? "flex-1 overflow-y-auto" : "overflow-y-auto")}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <FileSpreadsheet className="h-5 w-5" /> Import Administrative / Non-Teaching Excel
                </DialogTitle>
                <DialogDescription>
                  Extract the current non-teaching workbook, review the records first, then confirm the save to the database. Length of service is not imported because it is calculated from Date Hired.
                </DialogDescription>
              </DialogHeader>

              {!preview ? (
                <div className="space-y-4 pt-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-12 text-center transition hover:border-primary hover:bg-primary/10"
              >
                <Upload className="h-10 w-10 text-primary" />
                <p className="mt-3 max-w-full break-words px-2 text-sm font-medium leading-snug">
                  {selectedFile ? selectedFile.name : "Choose the Administration / Non-Teaching .xlsx workbook"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {previewMutation.isPending
                    ? importStage === "uploading"
                      ? "Uploading workbook to the server..."
                      : "Extracting employee data from the Excel sheet..."
                    : "Current parser expects the Employment Status sheet from your non-teaching workbook."}
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              <div className="min-w-0 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">What will be extracted</p>
                <p className="mt-1 break-words">The importer now distinguishes between two Excel types: an Employee Masterlist file and an ID Number Update file. An ID Number file is recognized from headers like `NEW ID NUMBER`, `LAST NAME`, `FIRST NAME`, and `MIDDLE NAME`. Employee masterlist files are recognized from broader employee information columns such as department, position, date hired, email, or employment status.</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-4 pt-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <SummaryCard label="Workbook" value={preview.fileName} className="md:col-span-2 xl:col-span-2" />
                <SummaryCard label="Sheet" value={preview.sheetName} />
                <SummaryCard label="Category" value={preview.staffCategory} />
                <SummaryCard label="Extracted" value={`${preview.records.length} rows`} />
                <SummaryCard label="Detected File Type" value={preview.workbookTypeLabel || (preview.workbookType === "id-number" ? "ID Number Update File" : "Employee Masterlist File")} />
              </div>
              {hasDuplicateWarnings ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" /> {isIdNumberPreview ? "ID number conflicts detected" : "Duplicate ID number, email, or full-name matches detected"}
                  </div>
                  <p className="mt-1">
{isIdNumberPreview
                      ? "Review these ID conflicts before importing. For ID number files, a duplicate is only flagged when the imported ID number is already assigned to another employee, or when the matched employee already has a different saved ID number."
                      : "Review these matches before importing. Repeated ID numbers, emails, or full names in the workbook should be checked carefully. New workbook records will still be added, while database matches can either update the saved employee record or keep the current database data. Distinct workbook emails can still match existing database emails, so those counts may both be 57 at the same time."}
                  </p>
                  {isIdNumberPreview ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Repeated ID number in workbook</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.duplicateFileIdNumbers.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">{preview.duplicates.duplicateFileIdNumbers.length > 0 ? preview.duplicates.duplicateFileIdNumbers.slice(0, 3).join(", ") : "None"}</p>
                      </div>
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">ID number already used</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.existingDbIdNumberConflicts.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">This imported ID number is already assigned to another employee.</p>
                      </div>
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Employee already has a different ID</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.existingDbEmployeeIdConflicts.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">Matched employee already has a saved ID number that differs from the imported one.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Repeated ID number in workbook</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.duplicateFileIdNumbers.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">{preview.duplicates.duplicateFileIdNumbers.length > 0 ? preview.duplicates.duplicateFileIdNumbers.slice(0, 3).join(", ") : "None"}</p>
                      </div>
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Repeated email in workbook</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.duplicateFileEmails.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">{preview.duplicates.duplicateFileEmails.length > 0 ? preview.duplicates.duplicateFileEmails.slice(0, 3).join(", ") : "None"}</p>
                      </div>
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Repeated full name in workbook</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.duplicateFileFullNames.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">{preview.duplicates.duplicateFileFullNames.length > 0 ? preview.duplicates.duplicateFileFullNames.slice(0, 2).join(", ") : "None"}</p>
                      </div>
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Database email matches</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.existingDbEmails.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">Matched by saved employee email.</p>
                      </div>
                      <div className="flex min-w-0 min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Database full-name matches</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.existingDbFullNames.length}</p>
                        <p className="mt-1 break-words text-xs leading-snug text-amber-900/90">Matched by saved employee name.</p>
                      </div>
                    </div>
                  )}
                  {preview.duplicates.matchRows.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-amber-200/80 bg-white/80">
                      <div className="border-b border-amber-200/80 px-4 py-3">
                        <p className="text-sm font-semibold text-amber-950">Duplicate comparison table</p>
                        <p className="mt-1 text-xs text-amber-900/90">{isIdNumberPreview ? "Compare only the imported ID number against the current database ID before deciding how to handle the conflict." : "Compare the imported employee info against the current database record before deciding how to handle duplicates."}</p>
                      </div>
                      <div className="max-h-72 overflow-x-hidden overflow-y-auto scroll-thin">
                        <div
                          ref={duplicateScrollRef}
                          className="hide-scrollbar overflow-x-auto"
                          onScroll={() => syncDuplicateHorizontalScroll("table")}
                        >
                          <table ref={duplicateTableRef} data-slot="table" className={cn("w-max caption-bottom table-auto text-sm", isIdNumberPreview ? "min-w-[840px]" : "min-w-[1680px]")}>
                            <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="min-w-[160px]">{isIdNumberPreview ? "Conflict" : "Matched By"}</TableHead>
                              <TableHead className="min-w-[120px]">Imported ID</TableHead>
                              <TableHead className="min-w-[120px]">Current DB ID</TableHead>
                              <TableHead className="min-w-[210px]">Imported Employee</TableHead>
                              <TableHead className="min-w-[210px]">Current DB Employee</TableHead>
{!isIdNumberPreview ? (<>
                              <TableHead className="min-w-[160px]">Imported Email</TableHead>
                              <TableHead className="min-w-[160px]">Current DB Email</TableHead>
                              <TableHead className="min-w-[150px]">Imported Position</TableHead>
                              <TableHead className="min-w-[150px]">Current DB Position</TableHead>
                              <TableHead className="min-w-[120px]">Imported Date Hired</TableHead>
                              <TableHead className="min-w-[120px]">Current DB Date Hired</TableHead>
                              <TableHead className="min-w-[120px]">Imported Status</TableHead>
                              <TableHead className="min-w-[120px]">Current DB Status</TableHead>
                              </>) : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview.duplicates.matchRows.map((row, index) => (
                              <TableRow key={`${row.existing.id}-${row.imported.idNumber}-${index}`}>
                                <TableCell>
                                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{row.conflictLabel ?? row.matchedBy}</Badge>
                                </TableCell>
                                <TableCell className="text-xs">{row.imported.idNumber || "-"}</TableCell>
                                <TableCell className="text-xs">{row.existing.idNumber || "-"}</TableCell>
                                <TableCell >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">{row.imported.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{row.imported.department}</p>
                                  </div>
                                </TableCell>
                                <TableCell >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">{row.existing.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{row.existing.department}</p>
                                  </div>
                                </TableCell>
{!isIdNumberPreview ? (<>
                                <TableCell className="text-xs">{row.imported.email}</TableCell>
                                <TableCell className="text-xs">{row.existing.email}</TableCell>
                                <TableCell className="text-xs">{row.imported.position}</TableCell>
                                <TableCell className="text-xs">{row.existing.position}</TableCell>
                                <TableCell className="text-xs">{formatDate(row.imported.dateHired)}</TableCell>
                                <TableCell className="text-xs">{formatDate(row.existing.dateHired)}</TableCell>
                                <TableCell><HexagonBadge color={employmentStatusColor(row.imported.employmentStatus as EmploymentStatus)}>{row.imported.employmentStatus}</HexagonBadge></TableCell>
                                <TableCell><HexagonBadge color={employmentStatusColor(row.existing.employmentStatus as EmploymentStatus)}>{row.existing.employmentStatus}</HexagonBadge></TableCell>
                                </>) : null}
                              </TableRow>
                            ))}
                          </TableBody>
                          </table>
                        </div>
                      </div>
                      <div className="border-t border-amber-200/80 bg-white/90 px-3 py-2">
                        <div
                          ref={duplicateBottomScrollRef}
                          className="h-3.5 overflow-x-scroll overflow-y-hidden scroll-thin"
                          style={{ scrollbarGutter: "stable" }}
                          onScroll={() => syncDuplicateHorizontalScroll("bottom")}
                        >
                          <div className="h-px" style={{ width: `${duplicateTableWidth}px` }} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Preview ready for HR confirmation
                  </div>
                  <p className="mt-1">
{isIdNumberPreview ? "Review the extracted ID number rows below before saving them. Preview numbering is only for counting and will not be stored." : "Review the extracted rows below before saving them to the employee masterlist. Preview numbering is only for counting and will not be stored."} {preview?.workbookTypeLabel ? ` Detected file: ${preview.workbookTypeLabel}.` : preview?.workbookType === "id-number" ? " Detected file: ID Number Update File." : " Detected file: Employee Masterlist File."} {preview?.workbookTypeReason ?? ""}
                  </p>
                </div>
              )}
              {previewRecords.length > 0 ? (
                <div className={cn(isIdNumberPreview ? "h-[28.5rem]" : "h-[22rem]", "shrink-0 overflow-hidden rounded-xl border border-border", hasDuplicateWarnings ? "mt-4" : "")}>
                  <div
                    ref={previewScrollRef}
                    className="h-full overflow-auto scroll-thin"
                    style={{ scrollbarGutter: "stable" }}
                  >
                    <table ref={previewTableRef} data-slot="table" className={cn("caption-bottom table-auto text-sm", isIdNumberPreview ? "w-full min-w-full" : "w-max min-w-[2080px]")}>
                      <TableHeader className="sticky top-0 z-10 bg-card [&_th]:bg-card">
                        <TableRow>
                          <TableHead className={cn(isIdNumberPreview ? "w-[88px]" : "w-12")}>Preview #</TableHead>
                          <TableHead className={cn(isIdNumberPreview ? "w-[180px]" : "min-w-[120px]")}>ID Number</TableHead>
                          <TableHead className={cn(isIdNumberPreview ? "w-[220px]" : "min-w-[120px]")}>Last Name</TableHead>
                          <TableHead className={cn(isIdNumberPreview ? "w-[220px]" : "min-w-[120px]")}>First Name</TableHead>
                          <TableHead className={cn(isIdNumberPreview ? "w-[220px]" : "min-w-[120px]")}>Middle Name</TableHead>
{!isIdNumberPreview ? (<>
                          <TableHead className="min-w-[80px]">Gender</TableHead>
                          <TableHead className="min-w-[140px]">Department</TableHead>
                          <TableHead className="min-w-[170px]">Position</TableHead>
                          <TableHead className="min-w-[150px]">Date Hired</TableHead>
                          <TableHead className="min-w-[120px]">E-Status</TableHead>
                          <TableHead className="min-w-[240px]">Email</TableHead>
                          <TableHead className="min-w-[260px]">Address</TableHead>
                          <TableHead className="min-w-[200px]">Bachelor</TableHead>
                          <TableHead className="min-w-[200px]">Master</TableHead>
                          <TableHead className="min-w-[200px]">Doctoral</TableHead>
                          </>) : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRecords.map((record, index) => (
                          <TableRow key={`${record.email}-${index}`}>
                            <TableCell className={cn("text-muted-foreground", isIdNumberPreview ? "w-[88px]" : undefined)}>{index + 1}</TableCell>
                            <TableCell className={cn("text-xs", isIdNumberPreview ? "w-[180px]" : undefined)}>{record.idNumber?.trim() || "-"}</TableCell>
                            <TableCell className={cn("font-medium", isIdNumberPreview ? "w-[220px]" : undefined)}>{record.lastName}</TableCell>
                            <TableCell className={cn(isIdNumberPreview ? "w-[220px]" : undefined)}>{record.firstName}</TableCell>
                            <TableCell className={cn("text-muted-foreground", isIdNumberPreview ? "w-[220px]" : undefined)}>{record.middleName || "-"}</TableCell>
{!isIdNumberPreview ? (<>
                            <TableCell>{record.gender}</TableCell>
                            <TableCell className="text-xs">{record.department}</TableCell>
                            <TableCell className="text-xs">{record.position}</TableCell>
                            <TableCell className="text-xs">{formatDate(record.dateHired)}</TableCell>
                            <TableCell>
                              <HexagonBadge color={employmentStatusColor(record.employmentStatus)}>
                                {record.employmentStatus}
                              </HexagonBadge>
                            </TableCell>
                            <TableCell className="text-xs">{record.email || "-"}</TableCell>
                            <TableCell className="text-xs">{record.address || "-"}</TableCell>
                            <TableCell className="text-xs">{educationValueFor(record, "Bachelor")}</TableCell>
                            <TableCell className="text-xs">{educationValueFor(record, "Master")}</TableCell>
                            <TableCell className="text-xs">{educationValueFor(record, "Doctoral")}</TableCell>
                            </>) : null}
                          </TableRow>
                        ))}
                      </TableBody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

            </div>

            <DialogFooter className="border-t bg-background px-6 py-4">
              <Button variant="outline" onClick={closeImportDialog}>
                {previewMutation.isPending || commitMutation.isPending ? "Cancel Import" : "Cancel"}
              </Button>
              {!preview ? (
                <Button onClick={startPreview} disabled={!selectedFile || previewMutation.isPending}>
                  {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                  {previewMutation.isPending ? (importStage === "uploading" ? "Uploading..." : "Extracting...") : "Extract Data"}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setPreview(null)} disabled={commitMutation.isPending}>
                    Choose Another File
                  </Button>
                  {hasDatabaseDuplicates ? (
                    <>
                      <Button
                        variant="default"
                        onClick={() => {
                          confirmImport(true);
                        }}
                        disabled={commitMutation.isPending}
                      >
                        {commitMutation.isPending && overwriteDuplicates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {commitMutation.isPending && overwriteDuplicates ? "Saving Import..." : isIdNumberPreview ? "Import and Replace Existing IDs" : "Import and Update Info"}
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => {
                          confirmImport(false);
                        }}
                        disabled={commitMutation.isPending}
                      >
                        {commitMutation.isPending && !overwriteDuplicates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {commitMutation.isPending && !overwriteDuplicates ? "Saving Import..." : isIdNumberPreview ? "Import and Keep Current IDs" : "Import and Keep DB Originals"}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => {
                      confirmImport();
                    }} disabled={commitMutation.isPending}>
                      {commitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {commitMutation.isPending ? "Saving Import..." : isIdNumberPreview ? "Confirm ID Number Import" : hasDuplicateWarnings ? "Confirm Import With Duplicates" : "Confirm Import to DB"}
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-muted/20 p-3", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-snug text-foreground">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  icon,
  value,
  onValueChange,
  options,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "Select";

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between rounded-md border bg-transparent px-3 text-sm font-normal shadow-xs hover:bg-transparent">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">{icon}</span>
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SearchableFilterSelect({
  label,
  icon,
  value,
  onValueChange,
  options,
  searchPlaceholder,
  emptyLabel,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "Select";

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between rounded-md border bg-transparent px-3 text-sm font-normal shadow-xs hover:bg-transparent">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">{icon}</span>
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SortableHead({
  label,
  k,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  return (
    <TableHead>
      <button className="inline-flex items-center gap-1 text-left" onClick={() => onSort(k)}>
        <span>{label}</span>
        <ArrowUpDown className={`h-3.5 w-3.5 ${sortKey === k ? "text-primary" : "text-muted-foreground"}`} />
        {sortKey === k && <span className="sr-only">{sortAsc ? "ascending" : "descending"}</span>}
      </button>
    </TableHead>
  );
}





























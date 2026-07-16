"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useWorkHive } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AttendanceRecord } from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { formatDateShort, formatTime12Hour } from "@/components/shared/helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  Search,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  UserCircle,
  Users,
  X,
} from "lucide-react";

type AttendancePageResponse = {
  month: string;
  monthLabel: string;
  availableMonths: string[];
  employees: Array<{ id: string; name: string; department: string; position: string }>;
  remarksOptions: string[];
  schedule: Array<{ day: string; label: string; in: string; out: string }>;
  summary: {
    daysPresent: number;
    employeesCount: number;
    lateIncidents: number;
    totalLateMinutes: number;
    totalUndertimeMinutes: number;
    totalOvertimeHours: number;
    absences: number;
    holidays: number;
    daysWorked: number;
    pendingValidationCount: number;
    pendingOvertimeCount: number;


  };
  records: Array<AttendanceRecord & {
    employeeName: string;
    department: string;
    position: string;
    approvedOvertimeHrs: number;
    requiresValidation: boolean;
  }>;
  deletedRecords: Array<AttendanceRecord & {
    employeeName: string;
    department: string;
    position: string;
    approvedOvertimeHrs: number;
    requiresValidation: boolean;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    scopedTotalRecords: number;
    totalPages: number;
  };
};

const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MIN_PICKER_YEAR = 2000;
const PREVIEW_TABLE_HEIGHT_CLASS = "h-[31rem]";

type ImportResponse = {
  fileName?: string;
  sheetName?: string;
  monthKey: string;
  imported: number;
  created: number;
  updated: number;
  skipped: number;
  duplicateRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  validationRecords: number;
  unknownEmployees: string[];
};

type AttendanceDuplicateMatchRow = {
  imported: {
    rowNumber: number;
    employeeName: string;
    department: string;
    position: string;
    date: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    remarks: string;
    validationFlags: string[];
  };
  existing: {
    id: string;
    employeeName: string;
    department: string;
    position: string;
    date: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    remarks: string;
    validationFlags: string[];
  };
  matchedBy: "Employee + Date + Source Name" | "Employee + Date" | "Source Name + Date";
};

type AttendanceImportPreviewPayload = {
  fileName: string;
  sheetName: string;
  monthKey: string;
  records: Array<{
    rowNumber: number;
    employeeName: string;
    matchedEmployeeName: string | null;
    department: string;
    position: string;
    date: string;
    dayName: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;
    remarks: string;
    validationFlags: string[];
    matched: boolean;
  }>;
  matchedRecords: number;
  unmatchedRecords: number;
  validationRecords: number;
  unknownEmployees: string[];
  duplicates: {
    existingAttendanceCount: number;
    uniqueRecordCount: number;
    matchRows: AttendanceDuplicateMatchRow[];
  };
};

async function parseJsonSafely<T>(response: Response) {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(response.ok ? "Empty server response." : "Request failed.");
  }

  try {
    return JSON.parse(raw) as T & { error?: string };
  } catch {
    throw new Error(response.ok ? "Invalid server response." : raw);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await parseJsonSafely<T>(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

async function previewAttendanceImport(file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/hr/attendance/import/preview", {
    method: "POST",
    body: formData,
    signal,
  });
  return readJson<AttendanceImportPreviewPayload>(response);
}

async function commitAttendanceImport(file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/hr/attendance/import", {
    method: "POST",
    body: formData,
    signal,
  });
  return readJson<ImportResponse>(response);
}

async function readAttendanceResponse(response: Response) {
  const payload = await parseJsonSafely<AttendancePageResponse>(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load attendance report.");
  }
  return payload;
}

async function requestAttendanceExport(payload: {
  classification: string;
  timeframeLabel: string;
  filters: Record<string, string>;
}) {
  const response = await fetch("/api/hr/attendance/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await parseJsonSafely<{ error?: string }>(response);
    throw new Error(errorPayload.error ?? "Unable to export attendance report.");
  }

  return response;
}

function buildQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

function buildAttendanceExportTimeframeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) {
    return "Date Range: " + format(new Date(dateFrom + "T00:00:00"), "MMMM d, yyyy") + " to " + format(new Date(dateTo + "T00:00:00"), "MMMM d, yyyy");
  }
  if (dateFrom) {
    return "Date From: " + format(new Date(dateFrom + "T00:00:00"), "MMMM d, yyyy");
  }
  if (dateTo) {
    return "Date To: " + format(new Date(dateTo + "T00:00:00"), "MMMM d, yyyy");
  }
  return "All attendance records";
}

function getDownloadFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

type AttendanceMode = "teaching" | "non-teaching";
type AttendanceLogRecord = AttendancePageResponse["records"][number];
type DeletedAttendanceLogRecord = AttendancePageResponse["deletedRecords"][number];

type AttendanceTimeEditForm = {
  morningIn: string;
  morningOut: string;
  afternoonIn: string;
  afternoonOut: string;
};

function createAttendanceTimeEditForm(record: Pick<AttendanceLogRecord, "morningIn" | "morningOut" | "afternoonIn" | "afternoonOut">): AttendanceTimeEditForm {
  return {
    morningIn: record.morningIn ?? "",
    morningOut: record.morningOut ?? "",
    afternoonIn: record.afternoonIn ?? "",
    afternoonOut: record.afternoonOut ?? "",
  };
}

function formatWorkHours(minutes: number | null | undefined) {
  if (minutes == null || minutes <= 0) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

async function patchAttendanceRecord<T>(payload: Record<string, unknown>) {
  const response = await fetch("/api/hr/attendance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<T>(response);
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const { setView, sidebarCollapsed } = useWorkHive();
  const { toast } = useToast();
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>("non-teaching");
  const [employeeId, setEmployeeId] = useState("all");
  const [remarks, setRemarks] = useState("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AttendanceImportPreviewPayload | null>(null);
  const [importStage, setImportStage] = useState<"idle" | "uploading" | "extracting" | "saving">("idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const [previewTableWidth, setPreviewTableWidth] = useState(1650);
  const duplicateScrollRef = useRef<HTMLDivElement | null>(null);
  const duplicateBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const duplicateTableRef = useRef<HTMLTableElement | null>(null);
  const [duplicateTableWidth, setDuplicateTableWidth] = useState(1700);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTableScrollRef = useRef<HTMLDivElement | null>(null);
  const previewBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const previewTableRef = useRef<HTMLTableElement | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceLogRecord | null>(null);
  const [editForm, setEditForm] = useState<AttendanceTimeEditForm>({
    morningIn: "",
    morningOut: "",
    afternoonIn: "",
    afternoonOut: "",
  });
  const [deleteRecord, setDeleteRecord] = useState<AttendanceLogRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const filters: Record<string, string> = {};

      if (employeeId !== "all") {
        filters.employeeId = employeeId;
      }
      if (remarks !== "all") {
        filters.remarks = remarks;
      }
      if (search.trim()) {
        filters.search = search.trim();
      }

      if (exportDateFrom) {
        filters.dateFrom = exportDateFrom;
      }
      if (exportDateTo) {
        filters.dateTo = exportDateTo;
      }

      const response = await requestAttendanceExport({
        classification: attendanceMode === "non-teaching" ? "Non-Teaching" : "Teaching",
        timeframeLabel: buildAttendanceExportTimeframeLabel(exportDateFrom, exportDateTo),
        filters,
      });
      const blob = await response.blob();
      return {
        blob,
        fileName: getDownloadFileName(response, "attendance-report-" + new Date().toISOString().slice(0, 10) + ".xlsx"),
      };
    },
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
      toast({
        title: "Attendance exported",
        description: "The Excel workbook was prepared and downloaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to export attendance",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  function syncPreviewHorizontalScroll(source: "table" | "bottom") {
    const tableScroll = previewTableScrollRef.current;
    const bottomScroll = previewBottomScrollRef.current;
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

  const attendanceQuery = useQuery({
    queryKey: ["hr-attendance", employeeId, remarks, deferredSearch, date, dateFrom, dateTo, page, pageSize],
    queryFn: async ({ signal }) => {
      const query = buildQueryString({ employeeId, remarks, search: deferredSearch, date, dateFrom, dateTo, page: String(page), pageSize: String(pageSize) });
      const response = await fetch(`/api/hr/attendance?${query}`, { cache: "no-store", signal });
      return readAttendanceResponse(response);
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const overtimeMutation = useMutation({
    mutationFn: async (payload: { id: string; approve: boolean }) => {
      return patchAttendanceRecord<{ record: AttendanceLogRecord }>(payload);
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      toast({
        title: variables.approve ? "Overtime approved" : "Overtime rejected",
        description: "The attendance record has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update overtime",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (payload: { id: string } & AttendanceTimeEditForm) =>
      patchAttendanceRecord<{ record: AttendanceLogRecord }>({ action: "edit", ...payload }),
    onSuccess: () => {
      setEditingRecord(null);
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      toast({
        title: "Attendance updated",
        description: "The employee punches and computed attendance values were refreshed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update attendance",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { id: string }) =>
      patchAttendanceRecord<{ ok: true }>({ action: "delete", ...payload }),
    onSuccess: () => {
      setDeleteRecord(null);
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      toast({
        title: "Attendance moved to recovery",
        description: "The record can still be restored within 7 days.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to delete attendance",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (payload: { id: string }) =>
      patchAttendanceRecord<{ record: DeletedAttendanceLogRecord }>({ action: "restore", ...payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      toast({
        title: "Attendance restored",
        description: "The deleted attendance record is active again.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to restore attendance",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });
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
    mutationFn: ({ file, signal }: { file: File; signal?: AbortSignal }) => previewAttendanceImport(file, signal),
    onSuccess: (payload) => {
      clearImportPendingState();
      setPreview(payload);
      toast({
        title: "Extraction complete",
        description: `${payload.records.length} rows were extracted. ${payload.duplicates.matchRows.length} already exist in attendance, ${payload.validationRecords} need validation review, and ${payload.unmatchedRecords} could not be matched automatically.`,
      });
    },
    onError: (error) => {
      clearImportPendingState();
      toast({
        title: "Unable to extract attendance",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: ({ file, signal }: { file: File; signal?: AbortSignal }) => commitAttendanceImport(file, signal),
    onSuccess: async (result) => {
      clearImportPendingState();
      setImportOpen(false);
      setSelectedFile(null);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      toast({
        title: "Attendance imported",
        description: `${result.imported} attendance rows were saved (${result.created} new, ${result.skipped} duplicate rows skipped). ${result.validationRecords} records were routed to Attendance Validation${result.unmatchedRecords > 0 ? `, including ${result.unmatchedRecords} unmatched employee rows` : ""}.`,
      });
    },
    onError: (error) => {
      clearImportPendingState();
      toast({
        title: "Unable to import attendance",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  function openImportDialog() {
    setImportOpen(true);
  }

  function openExportDialog() {
    setExportDateFrom(dateFrom);
    setExportDateTo(dateTo);
    setExportOpen(true);
  }

  function closeImportDialog() {
    if (importAbortRef.current) {
      importAbortRef.current.abort();
    }
    clearImportPendingState();
    setImportOpen(false);
    setSelectedFile(null);
    setPreview(null);
  }

  function selectFile(file: File | null) {
    if (importAbortRef.current) {
      importAbortRef.current.abort();
    }
    clearImportPendingState();
    setSelectedFile(file);
    setPreview(null);
  }

  function startPreview() {
    if (!selectedFile) {
      toast({
        title: "Excel file required",
        description: "Choose the Daily Time Record workbook first.",
        variant: "destructive",
      });
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

  function confirmImport() {
    if (!selectedFile || !preview) {
      return;
    }
    const controller = new AbortController();
    importAbortRef.current = controller;
    setImportStage("saving");
    launchTimerRef.current = setTimeout(() => {
      commitMutation.mutate({ file: selectedFile, signal: controller.signal });
    }, 50);
  }

  function confirmExport() {
    if (!exportDateFrom || !exportDateTo) {
      toast({
        title: "Complete the date range",
        description: "Choose both Date From and Date To before exporting.",
        variant: "destructive",
      });
      return;
    }

    if (exportDateFrom > exportDateTo) {
      toast({
        title: "Invalid date range",
        description: "Date From must be earlier than or equal to Date To.",
        variant: "destructive",
      });
      return;
    }

    exportMutation.mutate();
  }

  useEffect(() => () => {
    if (importAbortRef.current) {
      importAbortRef.current.abort();
    }
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
    }
    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const table = previewTableRef.current;
    const tableScroll = previewTableScrollRef.current;
    const bottomScroll = previewBottomScrollRef.current;
    if (!table || !tableScroll || !bottomScroll || !preview) {
      return;
    }

    const syncWidths = () => {
      const nextWidth = Math.max(table.scrollWidth, tableScroll.scrollWidth, 1650);
      setPreviewTableWidth(nextWidth);
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
  }, [preview]);

  const hasDuplicateWarnings =
    !!preview && preview.duplicates.matchRows.length > 0;
  const uniquePreviewRecords = useMemo(() => {
    if (!preview) {
      return [] as AttendanceImportPreviewPayload["records"];
    }

    const duplicateIndexes = new Set(preview.duplicates.matchRows.map((row) => row.imported.rowNumber));
    return preview.records
      .filter((_, index) => !duplicateIndexes.has(index + 1))
      .sort((left, right) => Number(left.matched) - Number(right.matched) || left.rowNumber - right.rowNumber);
  }, [preview]);
  const data = attendanceQuery.data;
  const records = data?.records ?? [];
  const deletedRecords = data?.deletedRecords ?? [];
  const filteredCount = data?.pagination.totalRecords ?? 0;

  if (attendanceQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading attendance report...</div>;
  }

  if (attendanceQuery.error || !data) {
    return <div className="p-6 text-muted-foreground">{attendanceQuery.error instanceof Error ? attendanceQuery.error.message : "Unable to load attendance report."}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Attendance Report</h1>
          </div>
          <p className="text-sm text-muted-foreground">{attendanceMode === "non-teaching" ? "Daily Time Record - UC South Campus - Non-Teaching personnel only" : "Daily Time Record - UC South Campus - Teaching personnel"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={openExportDialog}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={openImportDialog}>
            <Upload className="mr-2 h-4 w-4" /> Import from Excel
          </Button>
        </div>
      </div>

      <div className="flex w-full max-w-[448px] items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors ${attendanceMode === "teaching" ? "border border-primary/15 bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setAttendanceMode("teaching")}
          type="button"
        >
          <Users className={`h-4 w-4 ${attendanceMode === "teaching" ? "text-primary" : ""}`} /> Teaching
        </button>
        <button
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors ${attendanceMode === "non-teaching" ? "border border-primary/15 bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setAttendanceMode("non-teaching")}
          type="button"
        >
          <UserCircle className={`h-4 w-4 ${attendanceMode === "non-teaching" ? "text-primary" : ""}`} /> Non-Teaching
        </button>
      </div>

      {attendanceMode === "teaching" ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
            <Users className="h-8 w-8 text-primary" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Teaching attendance view</p>
              <p className="text-sm text-muted-foreground">Switch back to Non-Teaching to view the imported attendance records currently connected to the database.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Days Present" value={data.summary.daysPresent} sublabel={`${data.summary.employeesCount} employees`} color="text-green-600" />
        <KpiCard label="Late Incidents" value={data.summary.lateIncidents} sublabel={`${data.summary.totalLateMinutes} min total`} color="text-amber-600" accent />
        <KpiCard label="Undertime (min)" value={data.summary.totalUndertimeMinutes} sublabel="real DB totals" color="text-orange-600" />
        <KpiCard label="Overtime (hrs)" value={data.summary.totalOvertimeHours.toFixed(1)} sublabel="approved + pending" color="text-primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Reference Schedule (Mon-Sat)</CardTitle>
            <CardDescription>8:00 AM to 5:00 PM, with Saturday only until 12:00 PM.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {data.schedule.map((schedule) => (
                <div key={schedule.day} className={`rounded-lg border p-3 text-center ${schedule.day === "Sat" ? "border-gold/40 bg-gold/5" : "border-border bg-muted/30"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{schedule.day}</p>
                  <p className="mt-1 text-sm font-bold text-primary">{schedule.in}</p>
                  <p className="text-xs text-muted-foreground">to {schedule.out}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gold/30">
          <CardHeader>
            <CardTitle className="text-base">Period Summary</CardTitle>
            <CardDescription>{data.monthLabel} cutoff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <SummaryRow label="Days Worked" value={data.summary.daysWorked} color="text-primary" />
            <SummaryRow label="Absences" value={data.summary.absences} color="text-red-600" />
            <SummaryRow label="Holidays" value={data.summary.holidays} color="text-orange-600" />
            <SummaryRow label="Pending Validation" value={data.summary.pendingValidationCount} color="text-amber-600" />
            <SummaryRow label="Pending OT Review" value={data.summary.pendingOvertimeCount} color="text-primary" />


          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  placeholder="Search employee name or workbook name..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Records</Label>
              <div className="flex h-10 min-w-[190px] items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary">
                {filteredCount} of {data?.pagination.scopedTotalRecords ?? filteredCount} records
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="min-w-0 space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter className="h-3 w-3" /> View Employee</Label>
              <Select value={employeeId} onValueChange={(value) => { setEmployeeId(value); setPage(1); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} avoidCollisions={false} className="max-h-80">
                  <SelectItem value="all">All Non-Teaching Personnel</SelectItem>
                  {data.employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name} - {employee.position}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Remarks</Label>
              <Select value={remarks} onValueChange={(value) => { setRemarks(value); setPage(1); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} avoidCollisions={false} className="max-h-80">
                  <SelectItem value="all">All remarks</SelectItem>
                  {data.remarksOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <AttendanceFilterDateField label="Date" value={date} onChange={(value) => { setDate(value); setPage(1); }} />
            </div>
            <div className="min-w-0">
              <AttendanceFilterDateField label="Date From" value={dateFrom} onChange={(value) => { setDateFrom(value); setPage(1); }} />
            </div>
            <div className="min-w-0">
              <AttendanceFilterDateField label="Date To" value={dateTo} onChange={(value) => { setDateTo(value); setPage(1); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Log - Non-Teaching Personnel</CardTitle>
          <CardDescription>Morning and afternoon punches with live overtime confirmation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[38rem] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-48">Employee</TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-16">Day</TableHead>
                  <TableHead className="w-24 text-center">AM In</TableHead>
                  <TableHead className="w-24 text-center">AM Out</TableHead>
                  <TableHead className="w-24 text-center">PM In</TableHead>
                  <TableHead className="w-24 text-center">PM Out</TableHead>
                  <TableHead className="w-28 text-center">Work Hours</TableHead>
                  <TableHead className="w-20 text-right">Late</TableHead>
                  <TableHead className="w-20 text-right">UT</TableHead>
                  <TableHead className="w-20 text-right">OT</TableHead>
                  <TableHead className="w-40">Remarks</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} className={record.lateMin > 0 ? "bg-amber-500/5" : record.requiresValidation ? "bg-red-500/5" : "hover:bg-primary/5"}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HexagonAvatar name={record.employeeName} size={26} />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-xs font-semibold text-foreground">{record.employeeName}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{record.position}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs font-medium">{formatDateShort(record.date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.day}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.morningIn)}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.morningOut)}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.afternoonIn)}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.afternoonOut)}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs font-medium text-primary">{formatWorkHours(record.workHoursMin)}</TableCell>
                    <TableCell className={`text-right text-xs ${record.lateMin > 0 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>{record.lateMin > 0 ? `${record.lateMin}m` : "-"}</TableCell>
                    <TableCell className={`text-right text-xs ${record.undertimeMin > 0 ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>{record.undertimeMin > 0 ? `${record.undertimeMin}m` : "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs text-primary">{record.overtimeHrs > 0 ? `${record.overtimeHrs.toFixed(1)}h` : "-"}</TableCell>
                    <TableCell className="whitespace-nowrap"><AttendanceBadge record={record} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {record.overtimeStatus === "Pending" ? (
                          <Button size="sm" className="h-7 bg-green-600 px-2 hover:bg-green-700" onClick={() => overtimeMutation.mutate({ id: record.id, approve: true })}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {record.overtimeStatus === "Pending" ? (
                          <Button size="sm" variant="outline" className="h-7 border-red-300 px-2 text-red-600 hover:bg-red-50" onClick={() => overtimeMutation.mutate({ id: record.id, approve: false })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {record.requiresValidation ? (
                          <Button size="sm" variant="outline" onClick={() => setView("hr:attendance-validation")}>Review</Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditingRecord(record);
                            setEditForm(createAttendanceTimeEditForm(record));
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-red-300 px-2 text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteRecord(record)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-12 text-center text-muted-foreground">No non-teaching attendance records found for this filter.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {records.length === 0 ? 0 : (page - 1) * (data?.pagination.pageSize ?? pageSize) + 1}
              -{Math.min(page * (data?.pagination.pageSize ?? pageSize), data?.pagination.totalRecords ?? 0)} of {data?.pagination.totalRecords ?? 0} records
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Rows</Label>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="250">250</SelectItem>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deleted Attendance Recovery</CardTitle>
          <CardDescription>Deleted attendance stays here for 7 days before permanent cleanup. You can still restore it during that window and see which HR removed the record.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[26rem] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-48">Employee</TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-16">Day</TableHead>
                  <TableHead className="w-24 text-center">AM In</TableHead>
                  <TableHead className="w-24 text-center">AM Out</TableHead>
                  <TableHead className="w-24 text-center">PM In</TableHead>
                  <TableHead className="w-24 text-center">PM Out</TableHead>
                  <TableHead className="w-28 text-center">Work Hours</TableHead>
                  <TableHead className="w-40">Deleted At</TableHead>
                  <TableHead className="w-32">Deleted By</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedRecords.map((record) => (
                  <TableRow key={record.id} className="bg-red-500/5">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HexagonAvatar name={record.employeeName} size={26} />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-xs font-semibold text-foreground">{record.employeeName}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{record.position}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{formatDateShort(record.date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.day}</TableCell>
                    <TableCell className="text-xs">{formatTime12Hour(record.morningIn)}</TableCell>
                    <TableCell className="text-xs">{formatTime12Hour(record.morningOut)}</TableCell>
                    <TableCell className="text-xs">{formatTime12Hour(record.afternoonIn)}</TableCell>
                    <TableCell className="text-xs">{formatTime12Hour(record.afternoonOut)}</TableCell>
                    <TableCell className="text-right text-xs font-medium text-primary">{record.workHoursHrs != null ? `${record.workHoursHrs.toFixed(1)}h` : "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.deletedAt ? format(new Date(record.deletedAt), "MMM d, yyyy h:mm a") : "-"}</TableCell>
                    <TableCell className="text-xs">{record.deletedByName ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => restoreMutation.mutate({ id: record.id })} disabled={restoreMutation.isPending}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {deletedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">No deleted attendance records are waiting for recovery.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </>
      )}
      <Dialog open={!!editingRecord} onOpenChange={(open) => {
        if (!open && !editMutation.isPending) {
          setEditingRecord(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Attendance Punches</DialogTitle>
            <DialogDescription>Update the employee punch times. Late, undertime, overtime, work hours, and validation flags will be recalculated automatically.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="attendance-morning-in">AM In</Label>
              <Input id="attendance-morning-in" type="time" value={editForm.morningIn} onChange={(event) => setEditForm((current) => ({ ...current, morningIn: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-morning-out">AM Out</Label>
              <Input id="attendance-morning-out" type="time" value={editForm.morningOut} onChange={(event) => setEditForm((current) => ({ ...current, morningOut: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-afternoon-in">PM In</Label>
              <Input id="attendance-afternoon-in" type="time" value={editForm.afternoonIn} onChange={(event) => setEditForm((current) => ({ ...current, afternoonIn: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-afternoon-out">PM Out</Label>
              <Input id="attendance-afternoon-out" type="time" value={editForm.afternoonOut} onChange={(event) => setEditForm((current) => ({ ...current, afternoonOut: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)} disabled={editMutation.isPending}>Cancel</Button>
            <Button onClick={() => editingRecord && editMutation.mutate({ id: editingRecord.id, ...editForm })} disabled={!editingRecord || editMutation.isPending}>
              {editMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteRecord} onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) {
          setDeleteRecord(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the attendance record to the 7-day recovery table first. You can still restore it before it is permanently cleaned up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleteRecord) {
                  deleteMutation.mutate({ id: deleteRecord.id });
                }
              }}
              disabled={!deleteRecord || deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={exportOpen} onOpenChange={(open) => {
        if (!exportMutation.isPending) {
          setExportOpen(open);
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Export Attendance to Excel</DialogTitle>
            <DialogDescription>
              Choose the date range to export. The workbook will include all matching attendance rows in that timeframe, not just the current page.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <AttendanceFilterDateField
                label="Date From"
                value={exportDateFrom}
                onChange={(value) => {
                  setExportDateFrom(value);
                }}
              />
              <AttendanceFilterDateField
                label="Date To"
                value={exportDateTo}
                onChange={(value) => {
                  setExportDateTo(value);
                }}
              />
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Export scope</p>
              <p className="mt-1">
                Current employee, remarks, and search filters will also be applied to the selected date range export.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exportMutation.isPending}>Cancel</Button>
            <Button onClick={confirmExport} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exportMutation.isPending ? "Exporting..." : "Export to Excel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) closeImportDialog(); }}>
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className={cn(
            "overflow-hidden p-0",
            sidebarCollapsed ? "lg:left-[calc(50%+36px)]" : "lg:left-[calc(50%+128px)]",
            preview
              ? cn(
                  "h-[92vh] w-[98vw] !max-w-[84rem] sm:!max-w-[84rem]",
                  sidebarCollapsed ? "lg:w-[calc(100vw-8rem)]" : "lg:w-[calc(100vw-20rem)]",
                )
              : "max-h-[90vh] w-[min(92vw,34rem)] !max-w-[34rem] sm:!max-w-[34rem]"
          )}
        >
          <div className={cn("relative flex flex-col overflow-hidden", preview ? "h-full" : "max-h-[90vh]")}>
            {(importStage !== "idle" || previewMutation.isPending || commitMutation.isPending) ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/78 backdrop-blur-[2px]">
                <div className="w-full max-w-md px-6 text-center">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                  <p className="mt-4 text-sm font-semibold text-foreground">
                    {(importStage === "saving" || commitMutation.isPending)
                      ? "Saving attendance records..."
                      : importStage === "uploading"
                        ? "Uploading workbook..."
                        : "Extracting attendance data..."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(importStage === "saving" || commitMutation.isPending)
                      ? "Please wait while the verified attendance rows are written to the database."
                      : "Please keep this window open while we prepare the preview."}
                  </p>
                  <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-primary/12">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn("min-h-0 p-6", preview ? "flex flex-1 flex-col overflow-y-auto" : "overflow-y-auto")}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <FileSpreadsheet className="h-5 w-5" /> Import Attendance Workbook
                </DialogTitle>
                <DialogDescription>
                  Extract the raw Daily Time Record workbook first, let HR review the parsed rows, then confirm the save to the database. Employee number and workbook hours are ignored because the system computes attendance values from the punches.
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
                    <p className="mt-3 max-w-full break-words px-2 text-sm font-medium leading-snug text-foreground">
                      {selectedFile ? selectedFile.name : "Choose the Daily Time Record .xlsx workbook"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {previewMutation.isPending
                        ? importStage === "uploading"
                          ? "Uploading workbook to the server..."
                          : "Extracting attendance data from the Excel sheet..."
                        : "Current parser reads the raw Daily Time Record workbook for non-teaching attendance."}
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
                    <p className="mt-1 break-words">Employee number and hours worked are ignored. Matching is based on employee name, then attendance is prepared with late, undertime, overtime, absence, and validation flags before HR confirms the import.</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2.4fr)_repeat(5,minmax(0,1fr))]">
                    <SummaryCard label="Workbook" value={preview.fileName} className="md:col-span-2 xl:col-span-1" />
                    <SummaryCard label="Sheet" value={preview.sheetName} />
                    <SummaryCard label="Period" value={preview.monthKey} />
                    <SummaryCard label="Extracted" value={`${preview.records.length} rows`} />
                    <SummaryCard label="Matched" value={`${preview.matchedRecords} rows`} />
                    <SummaryCard label="Existing Attendance Matches" value={`${preview.duplicates.existingAttendanceCount} rows`} />
                  </div>

                  {hasDuplicateWarnings ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" /> Review suggested before saving
                      </div>
                      <p className="mt-1">
                        {preview.duplicates.matchRows.length} rows already exist in the attendance database, {preview.unmatchedRecords} rows could not be matched to an employee, and {preview.validationRecords} rows were flagged for HR validation. Review the duplicate comparison table first. Only unique attendance rows will be imported; duplicate rows will be skipped.
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Existing attendance matches</p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-amber-950">{preview.duplicates.existingAttendanceCount}</p>
                          <p className="mt-1 text-xs leading-snug text-amber-900/90">Employee/date combinations already saved in attendance.</p>
                        </div>
                        <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Unique attendance rows</p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-amber-950">{uniquePreviewRecords.length}</p>
                          <p className="mt-1 text-xs leading-snug text-amber-900/90">Rows that can be inserted as new attendance records.</p>
                        </div>
                        <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Unmatched employees</p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-amber-950">{preview.unmatchedRecords}</p>
                          <p className="mt-1 text-xs leading-snug text-amber-900/90">Rows that still need employee matching review.</p>
                        </div>
                        <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-amber-200/80 bg-white/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Validation flags</p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-amber-950">{preview.validationRecords}</p>
                          <p className="mt-1 text-xs leading-snug text-amber-900/90">Rows that still need HR validation after import.</p>
                        </div>
                      </div>
                      {preview.unknownEmployees.length > 0 ? (
                        <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/80 p-3 text-xs text-amber-900/90">
                          <p className="font-semibold text-amber-950">Unmatched employee names</p>
                          <p className="mt-1 break-words">{preview.unknownEmployees.join(", ")}</p>
                        </div>
                      ) : null}
                      {preview.duplicates.matchRows.length > 0 ? (
                        <div className="mt-4 overflow-hidden rounded-xl border border-amber-200/80 bg-white/80">
                          <div className="border-b border-amber-200/80 px-4 py-3">
                            <p className="text-sm font-semibold text-amber-950">Duplicate attendance comparison table</p>
                            <p className="mt-1 text-xs text-amber-900/90">Compare the imported attendance rows against the current saved attendance. Duplicate attendance rows will not be imported.</p>
                          </div>
                          <div className={cn(PREVIEW_TABLE_HEIGHT_CLASS, "overflow-x-hidden overflow-y-scroll scroll-thin")} style={{ scrollbarGutter: "stable" }}>
                            <div
                              ref={duplicateScrollRef}
                              className="hide-scrollbar overflow-x-auto"
                              onScroll={() => syncDuplicateHorizontalScroll("table")}
                            >
                              <table ref={duplicateTableRef} data-slot="table" className="w-max min-w-[1700px] caption-bottom table-auto text-sm">
                                <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white">
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="min-w-[140px]">Matched By</TableHead>
                                    <TableHead className="min-w-[190px]">Imported Employee</TableHead>
                                    <TableHead className="min-w-[190px]">Current DB Employee</TableHead>
                                    <TableHead className="min-w-[120px]">Date</TableHead>
                                    <TableHead className="min-w-[110px]">AM In</TableHead>
                                    <TableHead className="min-w-[110px]">Current AM In</TableHead>
                                    <TableHead className="min-w-[110px]">PM Out</TableHead>
                                    <TableHead className="min-w-[110px]">Current PM Out</TableHead>
                                    <TableHead className="min-w-[120px]">Imported Status</TableHead>
                                    <TableHead className="min-w-[120px]">Current Status</TableHead>
                                    <TableHead className="min-w-[180px]">Imported Review</TableHead>
                                    <TableHead className="min-w-[180px]">Current Review</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {preview.duplicates.matchRows.map((row, index) => (
                                    <TableRow key={`${row.existing.id}-${row.imported.rowNumber}-${index}`}>
                                      <TableCell>
                                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">{row.matchedBy}</Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-foreground">{row.imported.employeeName}</p>
                                          <p className="text-xs text-muted-foreground">{row.imported.department}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-foreground">{row.existing.employeeName}</p>
                                          <p className="text-xs text-muted-foreground">{row.existing.department}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs">{formatDateShort(row.imported.date)}</TableCell>
                                      <TableCell className="text-xs">{formatTime12Hour(row.imported.morningIn)}</TableCell>
                                      <TableCell className="text-xs">{formatTime12Hour(row.existing.morningIn)}</TableCell>
                                      <TableCell className="text-xs">{formatTime12Hour(row.imported.afternoonOut)}</TableCell>
                                      <TableCell className="text-xs">{formatTime12Hour(row.existing.afternoonOut)}</TableCell>
                                      <TableCell>
                                        <PreviewStatusBadge matched={row.imported.matched} validationFlags={row.imported.validationFlags} />
                                      </TableCell>
                                      <TableCell>
                                        <PreviewStatusBadge matched={true} validationFlags={row.existing.validationFlags} />
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{row.imported.validationFlags.length > 0 ? row.imported.validationFlags.join(", ") : "Ready to import"}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{row.existing.validationFlags.length > 0 ? row.existing.validationFlags.join(", ") : "Already saved"}</TableCell>
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
                        {preview.unmatchedRecords > 0 || preview.validationRecords > 0
                          ? `No saved attendance duplicates were found. ${preview.validationRecords} rows will be saved and routed to Attendance Validation${preview.unmatchedRecords > 0 ? `, including ${preview.unmatchedRecords} unmatched employee rows` : ""}. Review the unique attendance rows below, then confirm import to save them to the database.`
                          : "All extracted rows matched successfully and no saved attendance duplicates were found. Review the unique attendance rows below, then confirm import to save them to the database."}
                      </p>
                    </div>
                  )}
                  {uniquePreviewRecords.length > 0 ? (
                    <div className={cn(PREVIEW_TABLE_HEIGHT_CLASS, "shrink-0 overflow-hidden rounded-xl border border-border", hasDuplicateWarnings ? "mt-4" : "") }>
                      <div className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="border-b border-border/70 px-4 py-3 text-sm text-muted-foreground">
                          HR preview of unique attendance rows before database save.
                        </div>
                        <div
                          ref={previewTableScrollRef}
                          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
                          onScroll={() => syncPreviewHorizontalScroll("table")}
                        >
                          <table ref={previewTableRef} data-slot="table" className="w-max min-w-[1650px] caption-bottom table-auto text-sm">
                            <TableHeader className="sticky top-0 z-10 bg-card [&_th]:bg-card">
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead className="min-w-[190px]">Workbook Employee</TableHead>
                                <TableHead className="min-w-[220px]">Matched Employee / Validation</TableHead>
                                <TableHead className="min-w-[140px]">Department</TableHead>
                                <TableHead className="min-w-[150px]">Position</TableHead>
                                <TableHead className="min-w-[120px]">Date</TableHead>
                                <TableHead className="min-w-[110px]">Day</TableHead>
                                <TableHead>AM In</TableHead>
                                <TableHead>AM Out</TableHead>
                                <TableHead>PM In</TableHead>
                                <TableHead>PM Out</TableHead>
                                <TableHead className="text-right">Late</TableHead>
                                <TableHead className="text-right">UT</TableHead>
                                <TableHead className="text-right">OT</TableHead>
                                <TableHead className="min-w-[120px]">Status</TableHead>
                                <TableHead className="min-w-[180px]">Review</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {uniquePreviewRecords.map((record, index) => (
                                <TableRow key={`${record.rowNumber}-${record.employeeName}-${record.date}`}>
                                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                  <TableCell className="font-medium">{record.employeeName}</TableCell>
                                  <TableCell className="text-sm text-foreground">{record.matched ? record.matchedEmployeeName : "Not on employee list yet"}</TableCell>
                                  <TableCell className="text-xs">{record.matched ? record.department : "Unknown employee"}</TableCell>
                                  <TableCell className="text-xs">{record.matched ? record.position : "For validation"}</TableCell>
                                  <TableCell className="text-xs">{formatDateShort(record.date)}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{record.dayName}</TableCell>
                                  <TableCell className="text-xs">{formatTime12Hour(record.morningIn)}</TableCell>
                                  <TableCell className="text-xs">{formatTime12Hour(record.morningOut)}</TableCell>
                                  <TableCell className="text-xs">{formatTime12Hour(record.afternoonIn)}</TableCell>
                                  <TableCell className="text-xs">{formatTime12Hour(record.afternoonOut)}</TableCell>
                                  <TableCell className="text-right text-xs">{record.lateMinutes > 0 ? `${record.lateMinutes}m` : "-"}</TableCell>
                                  <TableCell className="text-right text-xs">{record.undertimeMinutes > 0 ? `${record.undertimeMinutes}m` : "-"}</TableCell>
                                  <TableCell className="text-right text-xs">{record.overtimeMinutes > 0 ? `${(record.overtimeMinutes / 60).toFixed(1)}h` : "-"}</TableCell>
                                  <TableCell>
                                    <PreviewStatusBadge matched={record.matched} validationFlags={record.validationFlags} />
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{record.validationFlags.length > 0 ? record.validationFlags.join(", ") : record.matched ? "Ready to import" : "Will be saved to Attendance Validation"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </table>
                        </div>
                        <div className="border-t border-border/70 bg-background/95 px-3 py-2">
                          <div
                            ref={previewBottomScrollRef}
                            className="h-3.5 overflow-x-scroll overflow-y-hidden scroll-thin"
                            style={{ scrollbarGutter: "stable" }}
                            onScroll={() => syncPreviewHorizontalScroll("bottom")}
                          >
                            <div className="h-px" style={{ width: `${previewTableWidth}px` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button variant="outline" onClick={closeImportDialog}>
                {(importStage !== "idle" || previewMutation.isPending || commitMutation.isPending) ? "Cancel Import" : "Cancel"}
              </Button>
              {!preview ? (
                <Button onClick={startPreview} disabled={!selectedFile || previewMutation.isPending}>
                  {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                  {previewMutation.isPending ? (importStage === "uploading" ? "Uploading..." : "Extracting...") : "Extract Data"}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setPreview(null)} disabled={(importStage === "saving" || commitMutation.isPending)}>
                    Choose Another File
                  </Button>
                  <Button onClick={confirmImport} disabled={(importStage === "saving" || commitMutation.isPending)}>
                    {(importStage === "saving" || commitMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {(importStage === "saving" || commitMutation.isPending)
                      ? "Saving Import..."
                      : hasDuplicateWarnings
                        ? "Import Unique Rows Only"
                        : "Confirm Import to DB"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceFilterDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const isValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
  const [displayMonth, setDisplayMonth] = useState<Date>(isValidDate ? parsedDate : new Date());
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - MIN_PICKER_YEAR + 1 }, (_, index) => currentYear - index);
  }, []);

  const calendarMonth = isValidDate && parsedDate ? new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1) : displayMonth;
  const activeMonthLabel = MONTH_OPTIONS[calendarMonth.getMonth()];
  const activeYear = calendarMonth.getFullYear();

  function moveMonth(direction: -1 | 1) {
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function selectMonth(monthIndex: number) {
    setDisplayMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setMonthOpen(false);
  }

  function selectYear(year: number) {
    setDisplayMonth((current) => new Date(year, current.getMonth(), 1));
    setYearOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background",
              !isValidDate && "text-muted-foreground",
            )}
          >
            <span>{isValidDate && parsedDate ? format(parsedDate, "MMMM d, yyyy") : `Select ${label.toLowerCase()}`}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-auto overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
          <div className="border-b border-border/60 px-3 pb-3 pt-4">
            <div className="relative flex items-center justify-center px-8">
              <Button type="button" variant="ghost" size="icon" className="absolute left-0 size-8 rounded-lg" onClick={() => moveMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center gap-2.5">
                <Popover open={monthOpen} onOpenChange={setMonthOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[6.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium">
                      <span>{activeMonthLabel}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid gap-1">
                        {MONTH_OPTIONS.map((monthName, index) => (
                          <Button key={monthName} type="button" variant={index === calendarMonth.getMonth() ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectMonth(index)}>
                            {monthName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover open={yearOpen} onOpenChange={setYearOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[5.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium">
                      <span>{activeYear}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-72 w-28 overflow-y-auto p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="grid gap-1">
                      {years.map((year) => (
                        <Button key={year} type="button" variant={year === activeYear ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectYear(year)}>
                          {year}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 size-8 rounded-lg" onClick={() => moveMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Calendar
            mode="single"
            month={calendarMonth}
            onMonthChange={setDisplayMonth}
            selected={isValidDate ? parsedDate : undefined}
            onSelect={(selectedDate) => {
              if (!selectedDate) {
                return;
              }
              onChange(format(selectedDate, "yyyy-MM-dd"));
            }}
            hideNavigation
            className="flex justify-center px-4 pb-4 pt-4"
            classNames={{
              root: "mx-auto w-fit",
              months: "w-fit",
              month: "w-fit gap-3",
              month_caption: "hidden",
              table: "w-full table-fixed border-collapse",
              weekdays: "grid grid-cols-7",
              week: "grid grid-cols-7 mt-2",
              weekday: "text-center text-[0.8rem] font-normal text-muted-foreground",
              day: "relative p-0 text-center",
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
function SummaryCard({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-muted/20 p-3", className)}>
      <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground" title={label}>{label}</p>
      <p className="mt-1 truncate text-sm font-semibold leading-snug text-foreground" title={String(value)}>{value}</p>
    </div>
  );
}

function PreviewStatusBadge({ matched, validationFlags }: { matched: boolean; validationFlags: string[] }) {
  if (!matched) {
    return <Badge variant="destructive" className="whitespace-nowrap">Unmatched</Badge>;
  }
  if (validationFlags.length > 0) {
    return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Needs validation</Badge>;
  }
  return <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">Matched</Badge>;
}

function KpiCard({ label, value, sublabel, color, accent }: { label: string; value: string | number; sublabel: string; color: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-gold/40" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function AttendanceBadge({ record }: { record: AttendancePageResponse["records"][number] }) {
  const remark = record.remarks?.trim() || "Present";

  if (record.requiresValidation) {
    return <HexagonBadge color="#dc2626">Validation</HexagonBadge>;
  }
  if (remark === "Holiday") {
    return <HexagonBadge color="#dc2626">Holiday</HexagonBadge>;
  }
  if (remark === "Weekend") {
    return <Badge variant="secondary">Weekend</Badge>;
  }
  if (remark === "Absent") {
    return <HexagonBadge color="#dc2626">Absent</HexagonBadge>;
  }
  if (remark === "On Leave") {
    return <HexagonBadge color="#2563eb">On Leave</HexagonBadge>;
  }
  if (remark === "Half Day") {
    return <HexagonBadge color="#2563eb">Half Day</HexagonBadge>;
  }
  if (remark === "Late + Undertime") {
    return <HexagonBadge color="#ea580c">Late + UT</HexagonBadge>;
  }
  if (remark === "Late") {
    return <HexagonBadge color="#ca8a04">Late</HexagonBadge>;
  }
  if (remark === "Undertime") {
    return <HexagonBadge color="#ea580c">Undertime</HexagonBadge>;
  }
  if (remark === "Overtime" && record.overtimeStatus === "Approved") {
    return <HexagonBadge color="#1d4ed8">OT Approved</HexagonBadge>;
  }
  if (remark === "Overtime" && record.overtimeStatus === "Pending") {
    return <HexagonBadge color="#ca8a04">OT Pending</HexagonBadge>;
  }
  if (remark === "Overtime" && record.overtimeStatus === "Rejected") {
    return <HexagonBadge color="#dc2626">Overtime Rejected</HexagonBadge>;
  }
  return <HexagonBadge color="#16a34a">{remark || "Present"}</HexagonBadge>;
}





























































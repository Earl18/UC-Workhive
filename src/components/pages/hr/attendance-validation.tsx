"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { AttendanceValidationFlag } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  UserSearch,
  X,
} from "lucide-react";

type ValidationResponse = {
  month: string;
  monthLabel: string;
  availableMonths: string[];
  employees: Array<{ id: string; name: string }>;
  issues: Array<{ value: string; label: string }>;
  counts: {
    pending: number;
    unresolvedOvertime: number;
    unmatchedEmployees: number;
    incompletePunches: number;
  };
  records: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    sourceEmployeeName?: string;
    department: string;
    position: string;
    date: string;
    day: string;
    morningIn?: string | null;
    morningOut?: string | null;
    afternoonIn?: string | null;
    afternoonOut?: string | null;
    timeIn?: string | null;
    timeOut?: string | null;
    scheduledIn?: string | null;
    scheduledOut?: string | null;
    lateMin: number;
    undertimeMin: number;
    overtimeHrs: number;
    overtimeStatus?: "Not Required" | "Pending" | "Approved" | "Rejected";
    validationStatus?: "Pending" | "Resolved";
    validationFlags?: AttendanceValidationFlag[];
    validationFlagLabels: string[];
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

type BulkResolvePreviewResponse = {
  month: string;
  monthLabel: string;
  issue: string;
  issueLabel: string;
  totalRecords: number;
  blockedRecords: number;
  resolvableRecords: number;
  records: ValidationResponse["records"];
};

type ValidationMetaResponse = {
  month: string;
  monthLabel: string;
  availableMonths: string[];
  employees: Array<{ id: string; name: string }>;
  issues: Array<{ value: string; label: string }>;
};

type FilterOption = { value: string; label: string };
type PunchFieldKey = "morningIn" | "morningOut" | "afternoonIn" | "afternoonOut";

type PunchResolveFormState = {
  morningIn: string;
  morningOut: string;
  afternoonIn: string;
  afternoonOut: string;
};

const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MIN_PICKER_YEAR = 2000;

function buildQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    params.set(key, normalized);
  }
  return params.toString();
}

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

async function readValidationResponse(response: Response) {
  const payload = await parseJsonSafely<ValidationResponse>(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load attendance validation records.");
  }
  return payload;
}

async function readBulkPreviewResponse(response: Response) {
  const payload = await parseJsonSafely<BulkResolvePreviewResponse>(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to preview bulk attendance validation resolve.");
  }
  return payload;
}

async function readValidationMetaResponse(response: Response) {
  const payload = await parseJsonSafely<ValidationMetaResponse>(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load attendance validation filters.");
  }
  return payload;
}

type ValidationSearchDateParts = { month: number; day: number; year?: number };

const VALIDATION_SEARCH_MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseValidationSearchDateParts(input: string) {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  const monthFirstMatch = normalized.match(/^([a-z]+) (\d{1,2})(?:,? (\d{4}))?$/);
  if (monthFirstMatch) {
    const [, monthLabel, dayRaw, yearRaw] = monthFirstMatch;
    const month = VALIDATION_SEARCH_MONTHS[monthLabel];
    const day = Number(dayRaw);
    const year = yearRaw ? Number(yearRaw) : undefined;
    if (month && day >= 1 && day <= 31) {
      return { month, day, year } satisfies ValidationSearchDateParts;
    }
  }

  return null as ValidationSearchDateParts | null;
}

function matchesValidationRecordSearch(record: ValidationResponse["records"][number], rawSearch: string) {
  const trimmedSearch = rawSearch.trim().toLowerCase();
  if (!trimmedSearch) {
    return true;
  }

  const parsedDateSearch = parseValidationSearchDateParts(trimmedSearch);
  const recordDate = new Date(`${record.date}T00:00:00`);
  if (parsedDateSearch) {
    const sameMonth = recordDate.getMonth() + 1 === parsedDateSearch.month;
    const sameDay = recordDate.getDate() === parsedDateSearch.day;
    const sameYear = parsedDateSearch.year == null || recordDate.getFullYear() === parsedDateSearch.year;
    return sameMonth && sameDay && sameYear;
  }

  const searchableValues = [
    record.employeeName,
    record.day,
    record.validationFlagLabels.join(" "),
    record.overtimeStatus === "Pending"
      ? "overtime requires hr confirmation"
      : record.overtimeStatus === "Rejected"
        ? "overtime rejected"
        : record.overtimeStatus === "Approved"
          ? "ot approved"
          : "",
    record.validationStatus ?? "",
    formatDateShort(record.date),
    format(recordDate, "MMM d, yyyy"),
    format(recordDate, "MMMM d, yyyy"),
    record.date,
  ];

  return searchableValues.some((value) => value.toLowerCase().includes(trimmedSearch));
}
export function AttendanceValidationPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState("");
  const [employeeId, setEmployeeId] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [bulkResolveOpen, setBulkResolveOpen] = useState(false);
  const [bulkAutoFillPrepared, setBulkAutoFillPrepared] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [punchResolveRecord, setPunchResolveRecord] = useState<ValidationResponse["records"][number] | null>(null);
  const [punchResolveForm, setPunchResolveForm] = useState<PunchResolveFormState>({
    morningIn: "",
    morningOut: "",
    afternoonIn: "",
    afternoonOut: "",
  });

  const validationMetaQuery = useQuery({
    queryKey: ["hr-attendance-validation-meta", month],
    queryFn: async ({ signal }) => {
      const query = buildQueryString({
        metaOnly: "1",
        month,
      });
      const response = await fetch(`/api/hr/attendance/validation?${query}`, { cache: "no-store", signal });
      return readValidationMetaResponse(response);
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const validationQuery = useQuery({
    queryKey: ["hr-attendance-validation", month, employeeId, issueFilter, date, dateFrom, dateTo, page, pageSize],
    queryFn: async ({ signal }) => {
      const query = buildQueryString({
        month,
        employeeId: employeeId,
        issue: issueFilter,
        date,
        dateFrom,
        dateTo,
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await fetch(`/api/hr/attendance/validation?${query}`, { cache: "no-store", signal });
      return readValidationResponse(response);
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/hr/attendance/validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await parseJsonSafely<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to resolve attendance validation.");
      }
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      toast({
        title: "Validation resolved",
        description: "The attendance issue has been marked as reviewed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to resolve validation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const punchResolveMutation = useMutation({
    mutationFn: async (payload: { id: string; morningIn: string | null; morningOut: string | null; afternoonIn: string | null; afternoonOut: string | null; markHalfDay?: boolean }) => {
      const response = await fetch("/api/hr/attendance/validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve-punches",
          ...payload,
        }),
      });
      const body = await parseJsonSafely<{ record?: ValidationResponse["records"][number]; error?: string }>(response);
      if (!response.ok || !body.record) {
        throw new Error(body.error ?? "Unable to update attendance punches.");
      }
      return body.record;
    },
    onSuccess: (record) => {
      setPunchResolveRecord(null);
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      const stillHasPunchIssues = hasPunchValidationIssues(record.validationFlags ?? []);
      const savedAsHalfDay = record.remarks === "Half Day";
      toast({
        title: stillHasPunchIssues
          ? "Punches still need review"
          : savedAsHalfDay
            ? "Half-day attendance saved"
            : record.requiresValidation
              ? "Punches updated"
              : "Attendance resolved",
        description: stillHasPunchIssues
          ? "The punches were updated, but the record still has incomplete punch issues."
          : savedAsHalfDay
            ? "The punches were saved and the attendance remark is now marked as Half Day."
            : record.requiresValidation
              ? "The punches were completed. Remaining non-punch issues still need HR review."
              : "The punches were completed and the validation item is now resolved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update punches",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/hr/attendance/validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-on-leave", id }),
      });
      const body = await parseJsonSafely<{ record?: ValidationResponse["records"][number]; error?: string }>(response);
      if (!response.ok || !body.record) {
        throw new Error(body.error ?? "Unable to mark attendance as on leave.");
      }
      return body.record;
    },
    onSuccess: () => {
      setPunchResolveRecord(null);
      setBulkResolveOpen(false);
      setSelectedRecordIds([]);
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      toast({
        title: "Attendance marked on leave",
        description: "The attendance record was updated to On Leave.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to mark On Leave",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const bulkResolveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/hr/attendance/validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk-resolve",
          month,
          employeeId: employeeId,
          issue: issueFilter,
            ids: activeSelectedRecordIds,
          date,
          dateFrom,
          dateTo,
        }),
      });
      const body = await parseJsonSafely<{ resolvedCount: number; issueLabel: string; markedOnLeave?: boolean; error?: string }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to bulk resolve attendance validation.");
      }
      return body;
    },
    onSuccess: (result) => {
      setBulkAutoFillPrepared(false);
      setBulkResolveOpen(false);
      setSelectedRecordIds([]);
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      toast({
        title: "Bulk validation resolved",
        description: `${result.resolvedCount} records were resolved for ${result.issueLabel}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to bulk resolve validation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const bulkAutoFillMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/hr/attendance/validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk-auto-fill-punches",
          month,
          employeeId: employeeId,
          issue: issueFilter,
            ids: activeSelectedRecordIds,
          date,
          dateFrom,
          dateTo,
        }),
      });
      const body = await parseJsonSafely<{ updatedCount: number; resolvedCount: number; remainingCount: number; issueLabel: string; error?: string }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to auto-complete missing punches.");
      }
      return body;
    },
    onSuccess: (result) => {
      setBulkAutoFillPrepared(false);
      setBulkResolveOpen(false);
      setSelectedRecordIds([]);
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      toast({
        title: "Missing punches auto-completed",
        description: result.remainingCount > 0
          ? `${result.updatedCount} records were updated for ${result.issueLabel}. ${result.resolvedCount} are now fully resolved and ${result.remainingCount} still need other HR review.`
          : `${result.updatedCount} records were updated and resolved for ${result.issueLabel}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to auto-complete missing punches",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const overtimeMutation = useMutation({
    mutationFn: async (payload: { id: string; approve: boolean }) => {
      const response = await fetch("/api/hr/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await parseJsonSafely<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to update overtime decision.");
      }
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      toast({
        title: "Overtime updated",
        description: "The overtime request has been reviewed.",
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

  const data = validationQuery.data;
  const metaData = validationMetaQuery.data;
  const isOvertimeIssue = issueFilter === "overtime:pending";
  const isLeaveAttendanceIssue = issueFilter === "flag:APPROVED_LEAVE_HAS_ATTENDANCE";
  const filteredRecords = useMemo(() => {
    const records = data?.records ?? [];
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      return records;
    }
    return records.filter((record) => matchesValidationRecordSearch(record, trimmedSearch));
  }, [data?.records, search]);
  const selectableIdsForSelection = filteredRecords
    .filter((record) => record.validationStatus !== "Resolved" && (isOvertimeIssue ? record.overtimeStatus === "Pending" : isLeaveAttendanceIssue ? true : record.overtimeStatus !== "Pending"))
    .map((record) => record.id);
  const activeSelectedRecordIds = selectableIdsForSelection.filter((id) => selectedRecordIds.includes(id));

  const canBulkResolve = issueFilter !== "all";
  const canBulkAutoFill = issueFilter === "flag:INCOMPLETE_PUNCHES";

  const bulkPreviewQuery = useQuery({
    queryKey: ["hr-attendance-validation-bulk-preview", month, employeeId, issueFilter, date, dateFrom, dateTo, activeSelectedRecordIds.join(",")],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries({
        bulkPreview: "1",
        month,
        employeeId: employeeId,
        issue: issueFilter,
        date,
        dateFrom,
        dateTo,
      })) {
        const normalized = value.trim();
        if (normalized) {
          params.set(key, normalized);
        }
      }
      for (const id of activeSelectedRecordIds) {
        params.append("id", id);
      }
      const response = await fetch(`/api/hr/attendance/validation?${params.toString()}`, { cache: "no-store", signal });
      return readBulkPreviewResponse(response);
    },
    enabled: bulkResolveOpen && canBulkResolve && activeSelectedRecordIds.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const bulkPreviewDisplayRecords = useMemo(() => {
    if (!bulkPreviewQuery.data?.records) {
      return [] as ValidationResponse["records"];
    }
    if (!bulkAutoFillPrepared || !canBulkAutoFill) {
      return bulkPreviewQuery.data.records;
    }
    return bulkPreviewQuery.data.records.map(applyAutoFillToPreviewRecord);
  }, [bulkAutoFillPrepared, bulkPreviewQuery.data?.records, canBulkAutoFill]);


  const isValidationLoading = validationQuery.isLoading;

  if (validationQuery.error) {
    return <div className="p-6 text-muted-foreground">{validationQuery.error instanceof Error ? validationQuery.error.message : "Unable to load attendance validation."}</div>;
  }

  const records = filteredRecords;
  const employeeOptions: FilterOption[] = [{ value: "all", label: "All validation items" }, ...((metaData?.employees ?? data?.employees ?? []).map((employee) => ({ value: employee.id, label: employee.name })))];
  const issueOptions: FilterOption[] = [{ value: "all", label: "All issues" }, ...((metaData?.issues ?? data?.issues ?? []))];
  const selectedIssueLabel = issueOptions.find((option) => option.value === issueFilter)?.label ?? "Selected issue";
  const selectableRecords = records.filter((record) => record.validationStatus !== "Resolved" && (isOvertimeIssue ? record.overtimeStatus === "Pending" : isLeaveAttendanceIssue ? true : record.overtimeStatus !== "Pending"));
  const selectableRecordIds = selectableRecords.map((record) => record.id);
  const selectedVisibleCount = activeSelectedRecordIds.length;
  const allSelectableChecked = selectableRecordIds.length > 0 && selectedVisibleCount === selectableRecordIds.length;
  const someSelectableChecked = selectedVisibleCount > 0 && !allSelectableChecked;

  function toTimeInputValue(value?: string | null) {
    return value ?? "";
  }

  function normalizePunchInputValue(value: string) {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  function hasLeaveAttendanceValidationIssue(flags: AttendanceValidationFlag[]) {
    return flags.includes("APPROVED_LEAVE_HAS_ATTENDANCE");
  }

  function hasPunchValidationIssues(flags: AttendanceValidationFlag[]) {
    return flags.includes("MISSING_MORNING_IN")
      || flags.includes("MISSING_LUNCH_OUT")
      || flags.includes("MISSING_AFTERNOON_IN")
      || flags.includes("ONLY_TIME_IN")
      || flags.includes("ONLY_TIME_OUT")
      || flags.includes("INCOMPLETE_PUNCHES")
      || flags.includes("POSSIBLE_HALF_DAY");
  }

  function getDefaultPunchValues(record: ValidationResponse["records"][number]) {
    const isSaturday = record.day.toLowerCase().startsWith("sat") || record.scheduledOut === "12:00";
    return {
      morningIn: record.scheduledIn || "08:00",
      morningOut: "12:00",
      afternoonIn: isSaturday ? "" : "13:00",
      afternoonOut: isSaturday ? "" : (record.scheduledOut || "17:00"),
    } satisfies PunchResolveFormState;
  }

  function applyAutoFillToPreviewRecord(record: ValidationResponse["records"][number]) {
    const defaults = getDefaultPunchValues(record);
    return {
      ...record,
      morningIn: record.morningIn ?? defaults.morningIn ?? null,
      morningOut: record.morningOut ?? defaults.morningOut ?? null,
      afternoonIn: record.afternoonIn ?? defaults.afternoonIn ?? null,
      afternoonOut: record.afternoonOut ?? defaults.afternoonOut ?? null,
    };
  }

  function getEditablePunchFields(record: ValidationResponse["records"][number]) {
    const editable = new Set<PunchFieldKey>();
    const flags = record.validationFlags ?? [];

    if (flags.includes("MISSING_MORNING_IN")) {
      editable.add("morningIn");
    }
    if (flags.includes("MISSING_LUNCH_OUT")) {
      editable.add("morningOut");
    }
    if (flags.includes("MISSING_AFTERNOON_IN")) {
      editable.add("afternoonIn");
    }
    if (flags.includes("ONLY_TIME_IN")) {
      if (record.morningIn && !record.morningOut) {
        editable.add("morningOut");
      }
      if (record.afternoonIn && !record.afternoonOut) {
        editable.add("afternoonOut");
      }
    }
    if (flags.includes("ONLY_TIME_OUT")) {
      if (record.morningOut && !record.morningIn) {
        editable.add("morningIn");
      }
      if (record.afternoonOut && !record.afternoonIn) {
        editable.add("afternoonIn");
      }
    }
    if ((flags.includes("INCOMPLETE_PUNCHES") || flags.includes("POSSIBLE_HALF_DAY")) && editable.size === 0) {
      if (!record.morningIn) editable.add("morningIn");
      if (!record.morningOut) editable.add("morningOut");
      if (!record.afternoonIn) editable.add("afternoonIn");
      if (!record.afternoonOut) editable.add("afternoonOut");
    }

    return editable;
  }

  function openPunchResolve(record: ValidationResponse["records"][number]) {
    setPunchResolveRecord(record);
    setPunchResolveForm({
      morningIn: toTimeInputValue(record.morningIn),
      morningOut: toTimeInputValue(record.morningOut),
      afternoonIn: toTimeInputValue(record.afternoonIn),
      afternoonOut: toTimeInputValue(record.afternoonOut),
    });
  }

  function autoFillMissingPunches() {
    if (!punchResolveRecord) {
      return;
    }
    const defaults = getDefaultPunchValues(punchResolveRecord);
    setPunchResolveForm((current) => ({
      morningIn: current.morningIn || defaults.morningIn,
      morningOut: current.morningOut || defaults.morningOut,
      afternoonIn: current.afternoonIn || defaults.afternoonIn,
      afternoonOut: current.afternoonOut || defaults.afternoonOut,
    }));
  }

  function autoFillHalfDayPunches() {
    if (!punchResolveRecord) {
      return;
    }

    const defaults = getDefaultPunchValues(punchResolveRecord);
    const hasMorningActivity = Boolean(punchResolveRecord.morningIn || punchResolveRecord.morningOut);
    const hasAfternoonActivity = Boolean(punchResolveRecord.afternoonIn || punchResolveRecord.afternoonOut);

    setPunchResolveForm((current) => {
      const next = { ...current };

      if (hasMorningActivity && !hasAfternoonActivity) {
        next.morningIn = current.morningIn || defaults.morningIn;
        next.morningOut = current.morningOut || defaults.morningOut;
        return next;
      }

      if (hasAfternoonActivity && !hasMorningActivity) {
        next.afternoonIn = current.afternoonIn || defaults.afternoonIn;
        next.afternoonOut = current.afternoonOut || defaults.afternoonOut;
        return next;
      }

      next.morningIn = current.morningIn || defaults.morningIn;
      next.morningOut = current.morningOut || defaults.morningOut;
      next.afternoonIn = current.afternoonIn || defaults.afternoonIn;
      next.afternoonOut = current.afternoonOut || defaults.afternoonOut;
      return next;
    });
  }

  function submitPunchResolve() {
    if (!punchResolveRecord) {
      return;
    }
    punchResolveMutation.mutate({
      id: punchResolveRecord.id,
      morningIn: normalizePunchInputValue(punchResolveForm.morningIn),
      morningOut: normalizePunchInputValue(punchResolveForm.morningOut),
      afternoonIn: normalizePunchInputValue(punchResolveForm.afternoonIn),
      afternoonOut: normalizePunchInputValue(punchResolveForm.afternoonOut),
      markHalfDay: isHalfDayResolve,
    });
  }

  function handleResolveClick(record: ValidationResponse["records"][number]) {
    if (hasLeaveAttendanceValidationIssue(record.validationFlags ?? [])) {
      openPunchResolve(record);
      return;
    }
    if (hasPunchValidationIssues(record.validationFlags ?? [])) {
      openPunchResolve(record);
      return;
    }
    resolveMutation.mutate(record.id);
  }

  function toggleRecordSelection(recordId: string, checked: boolean) {
    setSelectedRecordIds((current) => {
      if (checked) {
        return current.includes(recordId) ? current : [...current, recordId];
      }
      return current.filter((id) => id !== recordId);
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedRecordIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...selectableRecordIds]));
      }
      return current.filter((id) => !selectableRecordIds.includes(id));
    });
  }

  const punchResolveFlags = punchResolveRecord?.validationFlags ?? [];
  const isHalfDayResolve = punchResolveFlags.includes("POSSIBLE_HALF_DAY");
  const isLeaveAttendanceResolve = punchResolveFlags.includes("APPROVED_LEAVE_HAS_ATTENDANCE");
  const isReviewActionPending = punchResolveMutation.isPending || onLeaveMutation.isPending;

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance Validation</h1>
        <p className="text-sm text-muted-foreground">Review unmatched employees, incomplete punches, and overtime confirmations for {data?.monthLabel ?? metaData?.monthLabel ?? "the selected period"}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ValidationCard title="Pending Review" value={data?.counts.pending ?? 0} icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} accent />
        <ValidationCard title="Pending OT" value={data?.counts.unresolvedOvertime ?? 0} icon={<Clock3 className="h-4 w-4 text-primary" />} />
        <ValidationCard title="Unknown Employees" value={data?.counts.unmatchedEmployees ?? 0} icon={<UserSearch className="h-4 w-4 text-red-600" />} />
        <ValidationCard title="Incomplete Punches" value={data?.counts.incompletePunches ?? 0} icon={<ShieldCheck className="h-4 w-4 text-orange-600" />} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <Label htmlFor="attendance-validation-search" className="text-sm font-medium">Search</Label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="attendance-validation-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSelectedRecordIds([]);
                  }}
                  placeholder="Search employee, issue, day, or date..."
                  className="pl-10"
                />
              </div>
            </div>
            <Badge variant="outline" className="h-10 min-w-[7.5rem] shrink-0 justify-center border-primary/40 px-5 text-sm text-primary">{isValidationLoading ? 0 : records.length} items</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SearchableValidationFilterSelect
              label="Employee"
              value={employeeId}
              onValueChange={(value) => {
                setEmployeeId(value);
                setSelectedRecordIds([]);
                setPage(1);
              }}
              options={employeeOptions}
              searchPlaceholder="Search employee..."
              emptyLabel="No employee found."
              icon={<Search className="h-4 w-4" />}
            />
            <SearchableValidationFilterSelect
              label="Issues"
              value={issueFilter}
              onValueChange={(value) => {
                setIssueFilter(value);
                setSelectedRecordIds([]);
                setPage(1);
              }}
              options={issueOptions}
              searchPlaceholder="Search issue..."
              emptyLabel="No issue found."
              icon={<Filter className="h-4 w-4" />}
            />
            <ValidationFilterDateField
              label="Date"
              value={date}
              onChange={(nextValue) => {
                setDate(nextValue);
                if (nextValue) {
                  setDateFrom("");
                  setDateTo("");
                }
                setSelectedRecordIds([]);
                setPage(1);
              }}
            />
            <ValidationFilterDateField
              label="Date From"
              value={dateFrom}
              onChange={(nextValue) => {
                setDateFrom(nextValue);
                if (nextValue) {
                  setDate("");
                }
                setPage(1);
              }}
            />
            <ValidationFilterDateField
              label="Date To"
              value={dateTo}
              onChange={(nextValue) => {
                setDateTo(nextValue);
                if (nextValue) {
                  setDate("");
                }
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">Attendance Validation Queue</CardTitle>
            <CardDescription>Every attendance row that needs HR checking is listed here, including unknown employees and overtime confirmations.</CardDescription>
          </div>
          <div className="flex shrink-0 justify-end md:pl-4">
            <Button variant="outline" onClick={() => { setBulkAutoFillPrepared(false); setBulkResolveOpen(true); }} disabled={!canBulkResolve || activeSelectedRecordIds.length === 0}>
              {activeSelectedRecordIds.length > 0 ? (isLeaveAttendanceIssue ? `Bulk On Leave Selected (${activeSelectedRecordIds.length})` : `Bulk Resolve Selected (${activeSelectedRecordIds.length})`) : (isLeaveAttendanceIssue ? "Bulk On Leave" : "Bulk Resolve")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[40rem] overflow-auto rounded-lg border border-border">
            {isValidationLoading || !data ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading attendance validation records...
              </div>
            ) : (
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={allSelectableChecked ? true : someSelectableChecked ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                      aria-label="Select all visible validation records"
                      disabled={!canBulkResolve || selectableRecordIds.length === 0}
                      className="mx-auto"
                    />
                  </TableHead>
                  <TableHead className="w-[13.5rem]">Employee</TableHead>
                  <TableHead className="w-[7.5%]">Date</TableHead>
                  <TableHead className="w-[5%]">Day</TableHead>
                  <TableHead className="w-[8%] text-center">AM In</TableHead>
                  <TableHead className="w-[8%] text-center">AM Out</TableHead>
                  <TableHead className="w-[8%] text-center">PM In</TableHead>
                  <TableHead className="w-[8%] text-center">PM Out</TableHead>
                  <TableHead className="w-[24.5%]">Issues</TableHead>
                  <TableHead className="w-24 text-center">OT</TableHead>
                  <TableHead className="w-32 text-center">Status</TableHead>
                  <TableHead className="w-36 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const rowSelectable = canBulkResolve && record.validationStatus !== "Resolved" && (isOvertimeIssue ? record.overtimeStatus === "Pending" : isLeaveAttendanceIssue ? true : record.overtimeStatus !== "Pending");
                  const rowSelected = selectedRecordIds.includes(record.id);

                  return (
                  <TableRow key={record.id} className={record.validationStatus === "Resolved" ? "bg-muted/20" : "bg-amber-500/5"}>
                    <TableCell className="px-3 text-center">
                      <Checkbox
                        checked={rowSelected}
                        onCheckedChange={(checked) => toggleRecordSelection(record.id, checked === true)}
                        aria-label={`Select ${record.employeeName} ${record.date}`}
                        disabled={!rowSelectable}
                        className="mx-auto"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HexagonAvatar name={record.employeeName} size={26} />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-xs font-semibold text-foreground">{record.employeeName}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{record.employeeId ? record.position : record.sourceEmployeeName ?? "Unknown employee"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs font-medium">{formatDateShort(record.date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.day}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.morningIn)}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.morningOut)}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.afternoonIn)}</TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.afternoonOut)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex flex-wrap gap-1.5">
                        {record.validationFlagLabels.map((label) => <Badge key={label} variant="outline" className="border-amber-400/40 bg-amber-50 text-amber-700">{label}</Badge>)}
                        {record.validationFlagLabels.length === 0 && record.overtimeStatus !== "Pending" ? <span>-</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-center text-xs text-primary">{record.overtimeHrs > 0 ? `${record.overtimeHrs.toFixed(1)}h` : "-"}</TableCell>
                    <TableCell className="px-3 text-center">
                      <div className="flex justify-center">
                        {record.validationStatus === "Resolved" ? <HexagonBadge color="#16a34a">Resolved</HexagonBadge> : <HexagonBadge color="#ca8a04">Pending</HexagonBadge>}
                      </div>
                    </TableCell>
                    <TableCell className="pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {record.overtimeStatus === "Pending" ? (
                          <>
                            <Button size="sm" className="h-7 bg-green-600 px-2 hover:bg-green-700" onClick={() => overtimeMutation.mutate({ id: record.id, approve: true })}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 border-red-300 px-2 text-red-600 hover:bg-red-50" onClick={() => overtimeMutation.mutate({ id: record.id, approve: false })}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : null}
                        {record.validationStatus !== "Resolved" && (record.overtimeStatus !== "Pending" || hasLeaveAttendanceValidationIssue(record.validationFlags ?? [])) ? (
                          <Button size="sm" variant="outline" onClick={() => handleResolveClick(record)}>
                            Resolve
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
                })}
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">No attendance items matched the selected filters.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {isValidationLoading ? 0 : (data?.pagination.totalRecords ?? 0)} of {data?.pagination.scopedTotalRecords ?? data?.pagination.totalRecords ?? 0} records
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Rows</Label>
                <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setSelectedRecordIds([]); setPage(1); }}>
                  <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72 min-w-0">
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setSelectedRecordIds([]); setPage((current) => Math.max(1, current - 1)); }} disabled={isValidationLoading || (data?.pagination.page ?? 1) <= 1}>Previous</Button>
                <div className="min-w-[80px] text-center text-sm text-muted-foreground sm:min-w-[110px]">Page {data?.pagination.page ?? 1} of {data?.pagination.totalPages ?? 1}</div>
                <Button variant="outline" size="sm" onClick={() => { setSelectedRecordIds([]); setPage((current) => Math.min(data?.pagination.totalPages ?? current, current + 1)); }} disabled={isValidationLoading || (data?.pagination.page ?? 1) >= (data?.pagination.totalPages ?? 1)}>Next</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(punchResolveRecord)} onOpenChange={(open) => { if (!open) { setPunchResolveRecord(null); } }}>
        <DialogContent className="max-w-xl overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-2 px-6 pt-6">
            <DialogTitle>{isLeaveAttendanceResolve ? "Review Leave Attendance Conflict" : isHalfDayResolve ? "Review Possible Half-Day Attendance" : "Complete Missing Punches"}</DialogTitle>
            <DialogDescription>
              {isLeaveAttendanceResolve
                ? "This employee is already approved on leave for this date, but attendance punches were also recorded. Review the punches below before marking the day as On Leave."
                : isHalfDayResolve
                  ? "Review the half-day attendance first. You can use the half-day helper to complete only the active half before saving the punches."
                  : "Review the incomplete punches first. Once the missing time in or time out values are completed, the remaining issues can be reviewed normally."}
            </DialogDescription>
          </DialogHeader>

          {punchResolveRecord ? (
            <div className="min-w-0 space-y-4 px-6 pb-6">
              <div className="min-w-0 w-full rounded-xl border border-border bg-muted/20 p-3 text-sm">
                <div className="font-semibold text-foreground">{punchResolveRecord.employeeName}</div>
                <div className="text-muted-foreground">{formatDateShort(punchResolveRecord.date)} | {punchResolveRecord.day}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {punchResolveRecord.validationFlagLabels.map((label) => (
                    <Badge key={label} variant="outline" className="border-amber-400/40 bg-amber-50 text-amber-700">{label}</Badge>
                  ))}
                </div>
              </div>

              {isLeaveAttendanceResolve ? (
                <div className="overflow-hidden rounded-lg border border-border bg-background">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">AM In</TableHead>
                        <TableHead className="text-center">AM Out</TableHead>
                        <TableHead className="text-center">PM In</TableHead>
                        <TableHead className="text-center">PM Out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-center text-sm">{formatTime12Hour(punchResolveRecord.morningIn)}</TableCell>
                        <TableCell className="text-center text-sm">{formatTime12Hour(punchResolveRecord.morningOut)}</TableCell>
                        <TableCell className="text-center text-sm">{formatTime12Hour(punchResolveRecord.afternoonIn)}</TableCell>
                        <TableCell className="text-center text-sm">{formatTime12Hour(punchResolveRecord.afternoonOut)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <>
                  <div className="min-w-0 grid gap-3 sm:grid-cols-2">
                    <ValidationTimeField
                      label="AM In"
                      value={punchResolveForm.morningIn}
                      onChange={(value) => setPunchResolveForm((current) => ({ ...current, morningIn: value }))}
                      editable={getEditablePunchFields(punchResolveRecord).has("morningIn")}
                      highlight={getEditablePunchFields(punchResolveRecord).has("morningIn")}
                      presets={["08:00", "07:58", "08:20", "08:35"]}
                    />
                    <ValidationTimeField
                      label="AM Out / Lunch Out"
                      value={punchResolveForm.morningOut}
                      onChange={(value) => setPunchResolveForm((current) => ({ ...current, morningOut: value }))}
                      editable={getEditablePunchFields(punchResolveRecord).has("morningOut")}
                      highlight={getEditablePunchFields(punchResolveRecord).has("morningOut")}
                      presets={["12:00", "11:45", "12:05", "12:15"]}
                    />
                    <ValidationTimeField
                      label="PM In"
                      value={punchResolveForm.afternoonIn}
                      onChange={(value) => setPunchResolveForm((current) => ({ ...current, afternoonIn: value }))}
                      editable={getEditablePunchFields(punchResolveRecord).has("afternoonIn")}
                      highlight={getEditablePunchFields(punchResolveRecord).has("afternoonIn")}
                      presets={["13:00", "12:45", "13:02", "13:30"]}
                    />
                    <ValidationTimeField
                      label="PM Out"
                      value={punchResolveForm.afternoonOut}
                      onChange={(value) => setPunchResolveForm((current) => ({ ...current, afternoonOut: value }))}
                      editable={getEditablePunchFields(punchResolveRecord).has("afternoonOut")}
                      highlight={getEditablePunchFields(punchResolveRecord).has("afternoonOut")}
                      presets={["17:00", "15:45", "18:00"]}
                    />
                  </div>

                  <div className="min-w-0 w-full rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                    {isHalfDayResolve
                      ? "Half Day fills only the active half of the day. For example, a morning-only record can supply the missing AM Out without adding PM punches."
                      : "Automatic fill uses the non-teaching schedule defaults for the missing slot. For example, a missing PM In will be filled as 1:00 PM."}
                  </div>
                </>
              )}
            </div>
          ) : null}

          <DialogFooter className="flex-nowrap items-center gap-2 px-6 pb-6">
            <Button className="min-w-0 flex-1 whitespace-nowrap text-center sm:flex-none" variant="outline" onClick={() => setPunchResolveRecord(null)} disabled={isReviewActionPending}>Cancel</Button>
            {isLeaveAttendanceResolve ? (
              <Button className="min-w-0 flex-1 whitespace-nowrap px-3 text-center sm:flex-none" onClick={() => punchResolveRecord && onLeaveMutation.mutate(punchResolveRecord.id)} disabled={!punchResolveRecord || isReviewActionPending}>
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className={cn("h-4 w-4 animate-spin", onLeaveMutation.isPending ? "opacity-100" : "opacity-0")} />
                  <span>On Leave</span>
                </span>
              </Button>
            ) : (
              <>
                {isHalfDayResolve ? (
                  <Button className="min-w-0 flex-1 whitespace-nowrap text-center sm:flex-none" variant="outline" onClick={autoFillHalfDayPunches} disabled={!punchResolveRecord || isReviewActionPending}>Half Day</Button>
                ) : null}
                <Button className="min-w-0 flex-1 whitespace-nowrap px-3 text-center sm:flex-none" variant="outline" onClick={autoFillMissingPunches} disabled={!punchResolveRecord || isReviewActionPending}>Auto Fill Missing</Button>
                <Button className="min-w-0 flex-1 whitespace-nowrap px-3 text-center sm:flex-none" onClick={submitPunchResolve} disabled={!punchResolveRecord || isReviewActionPending}>
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className={cn("h-4 w-4 animate-spin", punchResolveMutation.isPending ? "opacity-100" : "opacity-0")} />
                    <span>Save Punches</span>
                  </span>
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkResolveOpen} onOpenChange={(open) => { if (!open) { setBulkAutoFillPrepared(false); } setBulkResolveOpen(open); }}>
        <DialogContent className="flex h-[min(88vh,64rem)] !w-[min(92vw,84rem)] !max-w-[min(92vw,84rem)] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-2 px-6 pt-6">
            <DialogTitle>{isLeaveAttendanceIssue ? "Bulk Mark On Leave" : "Bulk Resolve"} {selectedIssueLabel}</DialogTitle>
            <DialogDescription>{isLeaveAttendanceIssue ? "Review the selected attendance punches first, then mark these records as On Leave." : "Review the selected records first, then confirm the bulk resolve."}</DialogDescription>
          </DialogHeader>

          {!canBulkResolve ? (
            <div className="mx-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Pending overtime confirmations must still be reviewed individually, so they cannot be bulk resolved here.
            </div>
          ) : bulkPreviewQuery.isLoading ? (
            <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading bulk resolve preview...
            </div>
          ) : bulkPreviewQuery.error ? (
            <div className="mx-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {bulkPreviewQuery.error instanceof Error ? bulkPreviewQuery.error.message : "Unable to load bulk resolve preview."}
            </div>
          ) : bulkPreviewQuery.data ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 pb-6">
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected Issue</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{bulkPreviewQuery.data.issueLabel}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected Records</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{activeSelectedRecordIds.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Matched Records</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{bulkPreviewQuery.data.totalRecords}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resolvable Now</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{bulkPreviewQuery.data.resolvableRecords}</p>
                </div>
              </div>

              {bulkPreviewQuery.data.blockedRecords > 0 ? (
                <div className="mx-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  {bulkPreviewQuery.data.blockedRecords} records are still waiting for overtime review, so bulk resolve is blocked until those overtime items are decided.
                </div>
              ) : null}

              {canBulkAutoFill ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                  {bulkAutoFillPrepared ? "The preview below now shows the missing punches auto-completed using the non-teaching schedule defaults. Click Bulk Resolve on the right to save these completed values." : "Auto Complete All Missing will fill every missing punch in this preview using the non-teaching schedule defaults. Review the completed times below, then click Bulk Resolve on the right to save them."}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-background">
                <Table className="w-full table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-[28%]">Employee</TableHead>
                      <TableHead className="w-[7.5%]">Date</TableHead>
                      <TableHead className="w-[5%]">Day</TableHead>
                      <TableHead className="w-[8%] text-center">AM In</TableHead>
                      <TableHead className="w-[8%] text-center">AM Out</TableHead>
                      <TableHead className="w-[8%] text-center">PM In</TableHead>
                      <TableHead className="w-[8%] text-center">PM Out</TableHead>
                      <TableHead className="w-[24.5%]">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkPreviewDisplayRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <HexagonAvatar name={record.employeeName} size={26} />
                            <div className="min-w-0 leading-tight">
                              <p className="truncate text-xs font-semibold text-foreground">{record.employeeName}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{record.employeeId ? record.position : record.sourceEmployeeName ?? "Unknown employee"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-medium">{formatDateShort(record.date)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{record.day}</TableCell>
                        <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.morningIn)}</TableCell>
                        <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.morningOut)}</TableCell>
                        <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.afternoonIn)}</TableCell>
                        <TableCell className="whitespace-nowrap text-center text-xs">{formatTime12Hour(record.afternoonOut)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex flex-wrap gap-1.5">
                            {record.validationFlagLabels.map((label) => <Badge key={label} variant="outline" className="border-amber-400/40 bg-amber-50 text-amber-700">{label}</Badge>)}
                            {record.validationFlagLabels.length === 0 && record.overtimeStatus !== "Pending" ? <span>-</span> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {bulkPreviewDisplayRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No records matched the selected bulk resolve preview.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

            </div>
          ) : null}
          <DialogFooter className="shrink-0 flex-wrap items-stretch border-t border-border px-6 py-4 sm:items-center">
            <Button className="min-w-0 whitespace-normal text-center" variant="outline" onClick={() => setBulkResolveOpen(false)} disabled={bulkResolveMutation.isPending || bulkAutoFillMutation.isPending}>Cancel</Button>
            {canBulkAutoFill ? (
              <Button
                className="min-w-0 whitespace-normal text-center"
                variant="outline"
                onClick={() => setBulkAutoFillPrepared(true)}
                disabled={bulkAutoFillPrepared || !canBulkResolve || activeSelectedRecordIds.length === 0 || !bulkPreviewQuery.data || bulkPreviewQuery.data.totalRecords === 0 || bulkPreviewQuery.data.blockedRecords > 0 || bulkResolveMutation.isPending || bulkAutoFillMutation.isPending}
              >
                {bulkAutoFillMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {bulkAutoFillPrepared ? "Preview Auto-Completed" : "Auto Complete All Missing"}
              </Button>
            ) : null}
            <Button
              className="min-w-0 whitespace-normal text-center"
              onClick={() => { if (bulkAutoFillPrepared && canBulkAutoFill) { bulkAutoFillMutation.mutate(); return; } bulkResolveMutation.mutate(); }}
              disabled={!canBulkResolve || activeSelectedRecordIds.length === 0 || !bulkPreviewQuery.data || bulkPreviewQuery.data.totalRecords === 0 || bulkPreviewQuery.data.blockedRecords > 0 || bulkResolveMutation.isPending || bulkAutoFillMutation.isPending}
            >
              {bulkResolveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLeaveAttendanceIssue ? `Mark ${bulkPreviewQuery.data?.resolvableRecords ?? 0} Selected Records On Leave` : `Bulk Resolve ${bulkPreviewQuery.data?.resolvableRecords ?? 0} Selected Records`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

function ValidationCard({ title, value, icon, accent }: { title: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={accent ? "border-gold/40" : undefined}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}

function SearchableValidationFilterSelect({
  label,
  value,
  onValueChange,
  options,
  searchPlaceholder,
  emptyLabel,
  icon,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  searchPlaceholder: string;
  emptyLabel: string;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "Select";
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedSearch))
    : options;
  const visibleOptions = filteredOptions.slice(0, 120);
  const hasMoreResults = filteredOptions.length > visibleOptions.length;

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearch("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between rounded-md border bg-transparent px-3 text-sm font-normal shadow-xs hover:bg-transparent">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">{icon}</span>
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start" sideOffset={6}>
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 bg-background">
              {visibleOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
              ) : (
                <div className="grid gap-1 p-1">
                  {visibleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                        value === option.value && "bg-muted font-medium text-foreground",
                      )}
                      onClick={() => {
                        onValueChange(option.value);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("h-4 w-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {hasMoreResults ? (
              <p className="px-1 text-xs text-muted-foreground">Showing first {visibleOptions.length} matches. Keep typing to narrow the list.</p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ValidationTimeField({
  label,
  value,
  onChange,
  editable,
  highlight,
  presets,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
  highlight?: boolean;
  presets: string[];
}) {
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(value);
  const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")), []);
  const normalizedLabel = label.trim().toUpperCase();
  const isLunchOutField = normalizedLabel.includes("LUNCH OUT");
  const inferredPeriod = useMemo<"AM" | "PM">(() => (normalizedLabel.startsWith("AM") ? "AM" : "PM"), [normalizedLabel]);
  const timeParts = useMemo(() => {
    if (!value) {
      return { hour: "", minute: "" };
    }

    const [hourRaw, minuteRaw] = value.split(":");
    const hour24 = Number(hourRaw);
    const minute = String(Number.isNaN(Number(minuteRaw)) ? 0 : Number(minuteRaw)).padStart(2, "0");

    const normalizedHour = hour24 % 12 || 12;

    return {
      hour: String(normalizedHour).padStart(2, "0"),
      minute,
    };
  }, [value]);

  function updateTimePart(next: Partial<typeof timeParts>) {
    const hour = next.hour ?? timeParts.hour ?? "";
    const minute = next.minute ?? timeParts.minute ?? "";
    const numericHour = Number(hour);
    const period = isLunchOutField
      ? (numericHour === 12 || numericHour <= 6 ? "PM" : "AM")
      : inferredPeriod;

    if (!hour || !minute) {
      onChange("");
      return;
    }

    let hour24 = Number(hour) % 12;
    if (period === "PM") {
      hour24 += 12;
    }
    if (period === "AM" && numericHour === 12) {
      hour24 = 0;
    }
    if (period === "PM" && numericHour === 12) {
      hour24 = 12;
    }

    onChange(`${String(hour24).padStart(2, "0")}:${minute}`);
  }

  return (
    <div className="space-y-1.5">
      <Label className={cn("text-xs", highlight ? "text-amber-700" : "text-muted-foreground")}>{label}</Label>
      <Popover open={editable ? open : false} onOpenChange={editable ? setOpen : undefined}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={!editable}
            className={cn(
              "h-10 w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background",
              !hasValue && "text-muted-foreground",
              highlight && "border-amber-300 bg-amber-50/40",
              !editable && "cursor-default opacity-100",
            )}
          >
            <span>{hasValue ? formatTime12Hour(value) : "--:-- --"}</span>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
          <div className="border-b border-border/60 px-3 pb-3 pt-4">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            <div className="mt-1 text-xs text-muted-foreground">Edit the missing punch or choose a quick schedule-based time.</div>
          </div>
          <div className="space-y-3 px-3 pb-4 pt-4">
            <div className="flex h-11 items-center justify-between rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground">
              <span>{hasValue ? formatTime12Hour(value) : "--:-- --"}</span>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={timeParts.hour} onValueChange={(nextHour) => updateTimePart({ hour: nextHour, minute: timeParts.minute || "00" })}>
                <SelectTrigger className="h-9 w-full rounded-lg border-input bg-background px-3 font-medium">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-72 min-w-0">
                  {hourOptions.map((hour) => (
                    <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeParts.minute} onValueChange={(nextMinute) => updateTimePart({ hour: timeParts.hour || "12", minute: nextMinute })}>
                <SelectTrigger className="h-9 w-full rounded-lg border-input bg-background px-3 font-medium">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-72 min-w-0">
                  {minuteOptions.map((minute) => (
                    <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

            </div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={value === preset ? "secondary" : "outline"}
                  className="h-9 justify-center rounded-lg"
                  onClick={() => {
                    onChange(preset);
                    setOpen(false);
                  }}
                >
                  {formatTime12Hour(preset)}
                </Button>
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" className="h-9 rounded-lg px-2 text-muted-foreground" onClick={() => onChange("")}>Clear</Button>
              <Button type="button" className="h-9 rounded-lg px-3" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ValidationFilterDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const isValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
  const [displayMonth, setDisplayMonth] = useState<Date>(isValidDate ? parsedDate : new Date());
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const years = Array.from({ length: new Date().getFullYear() - MIN_PICKER_YEAR + 1 }, (_, index) => new Date().getFullYear() - index);

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



































































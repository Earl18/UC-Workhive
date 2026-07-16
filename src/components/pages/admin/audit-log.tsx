"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  Search,
  Download,
  ArrowUpDown,
  History,
  Clock,
  RefreshCw,
  Lock,
  Users,
  Plane,
  Briefcase,
  Settings,
  Layers,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { useAdminAuditLog } from "@/hooks/use-feature-toggles";
import { HexagonAvatar } from "@/components/shared/hexagon";
import type { AuditLogEntry } from "@/lib/types";

const CATEGORIES: AuditLogEntry["category"][] = [
  "Auth",
  "Employee",
  "Attendance",
  "Leave",
  "Recruitment",
  "System",
];

const CATEGORY_COLORS: Record<AuditLogEntry["category"], string> = {
  Auth: "#1d4ed8",
  Employee: "#0e7490",
  Attendance: "#ca8a04",
  Leave: "#7c3aed",
  Recruitment: "#16a34a",
  System: "#6b7280",
};

const CATEGORY_ICONS = {
  all: Layers,
  Auth: Lock,
  Employee: Users,
  Attendance: Clock,
  Leave: Plane,
  Recruitment: Briefcase,
  System: Settings,
} as const;

type CategoryKey = keyof typeof CATEGORY_ICONS;

const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All" },
] as const;
type DateRange = (typeof DATE_RANGES)[number]["value"];

type Severity = { level: "normal" | "warning" | "critical"; color: string; label: string };

function severityFor(action: string): Severity {
  const a = action.toLowerCase();
  if (
    a.includes("delete") ||
    a.includes("remove") ||
    a.includes("reject") ||
    a.includes("disapprove")
  ) {
    return { level: "critical", color: "#dc2626", label: "Critical" };
  }
  if (a.includes("disable") || a.includes("update") || a.includes("edit") || a.includes("change")) {
    return { level: "warning", color: "#ca8a04", label: "Warning" };
  }
  return { level: "normal", color: "#1d4ed8", label: "Normal" };
}

function categoryBadge(cat: AuditLogEntry["category"]) {
  const color = CATEGORY_COLORS[cat];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      <span
        className="hexagon inline-block"
        style={{ width: 6, height: 7, backgroundColor: color }}
      />
      {cat}
    </span>
  );
}

function actionBadge(action: string, cat: AuditLogEntry["category"]) {
  const color = CATEGORY_COLORS[cat];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color,
        border: `1px solid ${color}55`,
        backgroundColor: `${color}0f`,
      }}
    >
      {action}
    </span>
  );
}

function splitTimestamp(ts: string) {
  const [date = "", time = ""] = ts.split(" ");
  return { date, time };
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseAuditDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function daysAgoLabel(dateStr: string, todayDate: Date) {
  if (!dateStr) return "";
  const d = startOfDay(parseAuditDate(dateStr));
  const diff = Math.round((todayDate.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 0) return "Future";
  return `${diff}d ago`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildExcelXml(entries: AuditLogEntry[]) {
  const rows = entries.map((entry) => {
    const severity = severityFor(entry.action).label;
    return [
      entry.timestamp,
      entry.user,
      entry.action,
      entry.category,
      severity,
      entry.detail,
    ];
  });

  const headers = ["Timestamp", "User", "Action", "Category", "Severity", "Detail"];
  const allRows = [headers, ...rows];
  const columnWidths = headers.map((header, index) => {
    const longest = Math.max(
      header.length,
      ...rows.map((row) => String(row[index] ?? "").length),
    );
    return Math.min(Math.max(longest + 4, 14), 80) * 7;
  });

  const xmlRows = allRows
    .map((row, rowIndex) => {
      const styleId = rowIndex === 0 ? "Header" : "Cell";
      const cells = row
        .map((cell) => `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(String(cell ?? ""))}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xmlColumns = columnWidths
    .map((width) => `<Column ss:AutoFitWidth="1" ss:Width="${width}"/>`)
    .join("");

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Top"/>
    </Style>
    <Style ss:ID="Cell">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Audit Log">
    <Table>
      ${xmlColumns}
      ${xmlRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

function buildPrintMarkup(organizationName: string, entries: AuditLogEntry[]) {
  const rows = entries.map((entry) => {
    const severity = severityFor(entry.action).label;
    return `
      <tr>
        <td>${entry.timestamp}</td>
        <td>${entry.user}</td>
        <td>${entry.action}</td>
        <td>${entry.category}</td>
        <td>${severity}</td>
        <td>${entry.detail}</td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Audit Log Print View</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0 0 16px; color: #475569; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; }
      .meta { margin-bottom: 20px; font-size: 12px; color: #475569; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <h1>Audit Log</h1>
    <p>${organizationName}</p>
    <div class="meta">Printed ${new Date().toLocaleString()}</div>
    <table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>User</th>
          <th>Action</th>
          <th>Category</th>
          <th>Severity</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6">No audit entries to print.</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`;
}

export function AuditLogPage() {
  const { data: auditData, isLoading, error } = useAdminAuditLog();
  const { data } = useSystemSettings();
  const organizationName = data?.settings?.organizationName ?? "University of Cebu - South Campus";
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AuditLogEntry["category"]>("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [isExporting, setIsExporting] = useState(false);

  const auditLog = auditData?.auditLog ?? [];
  const todayDate = useMemo(() => startOfDay(new Date()), []);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: auditLog.length };
    for (const c of CATEGORIES) {
      m[c] = auditLog.filter((e) => e.category === c).length;
    }
    return m;
  }, [auditLog]);

  const maxCount = Math.max(1, ...Object.values(counts));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = auditLog.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      const entryDate = startOfDay(parseAuditDate(splitTimestamp(e.timestamp).date));
      const diffDays = Math.floor((todayDate.getTime() - entryDate.getTime()) / 86400000);
      if (dateRange === "today" && diffDays !== 0) return false;
      if (dateRange === "7d" && (diffDays < 0 || diffDays > 6)) return false;
      if (dateRange === "30d" && (diffDays < 0 || diffDays > 29)) return false;
      if (!q) return true;
      return (
        e.user.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q)
      );
    });
    list.sort((a, b) => {
      const cmp = a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [auditLog, search, categoryFilter, sortAsc, dateRange, todayDate]);

  const activityTimeline = useMemo(() => {
    const days: { date: string; label: string; count: number; isToday: boolean }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const iso = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
      const count = auditLog.filter((e) => splitTimestamp(e.timestamp).date === iso).length;
      days.push({
        date: iso,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
        isToday: i === 0,
      });
    }
    return days;
  }, [auditLog, todayDate]);

  const latestTimestamp = useMemo(() => {
    if (auditLog.length === 0) return null;
    return auditLog.reduce(
      (max, e) => (e.timestamp > max ? e.timestamp : max),
      auditLog[0].timestamp,
    );
  }, [auditLog]);

  const handleExport = async () => {
    if (typeof window === "undefined" || isExporting) {
      return;
    }

    try {
      setIsExporting(true);
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      const workbook = buildExcelXml(filtered);
      const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      link.href = url;
      link.download = `audit-log-${stamp}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exported audit log",
        description: `${filtered.length} entries downloaded as Excel.`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (typeof window === "undefined") {
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      toast({
        title: "Unable to print",
        description: "Please allow pop-ups for this page and try again.",
        variant: "destructive",
      });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintMarkup(organizationName, filtered));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };

    toast({
      title: "Preparing print view",
      description: `${filtered.length} audit entries opened in a printable view.`,
    });
  };

  const categoryCards: { key: CategoryKey; label: string; count: number }[] = [
    { key: "all", label: "All Events", count: counts.all },
    ...CATEGORIES.map((c) => ({ key: c as CategoryKey, label: c, count: counts[c] ?? 0 })),
  ];

  if (isLoading && !auditData) {
    return <div className="p-6 text-sm text-muted-foreground">Loading audit log...</div>;
  }

  if (error && !auditData) {
    return <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load audit log."}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <History className="h-3 w-3" />
              Immutable System Record
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Immutable record of all system activity across {organizationName} WorkHive modules.
          </p>
          {latestTimestamp && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>Last updated</span>
              <span className="font-mono text-foreground/70">
                {splitTimestamp(latestTimestamp).date} {splitTimestamp(latestTimestamp).time}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {categoryCards.map((card) => {
          const Icon = CATEGORY_ICONS[card.key];
          const isAll = card.key === "all";
          const color = isAll ? "var(--primary)" : CATEGORY_COLORS[card.key as AuditLogEntry["category"]];
          const isSelected = categoryFilter === card.key;
          const pct = Math.round((card.count / maxCount) * 100);
          return (
            <button
              key={card.key}
              onClick={() => setCategoryFilter(card.key)}
              className={`group relative overflow-hidden rounded-xl border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                isSelected ? "border-transparent shadow-sm" : "border-border hover:border-primary/40"
              }`}
              style={
                isSelected
                  ? {
                      borderLeft: `3px solid ${color}`,
                      background: `linear-gradient(135deg, ${color}14, transparent 65%)`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: isAll ? "var(--primary)" : `${color}1a`,
                    color: isAll ? "var(--primary-foreground)" : color,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {isSelected && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
                    Active
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-0.5 text-2xl font-bold" style={{ color }}>
                {card.count}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, pct)}%`, backgroundColor: color }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" />
                Activity Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Audit events per day - last 14 days
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {auditLog.length} total events
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityTimeline} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={24}
                />
                <Tooltip
                  cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                  formatter={(value) => [`${value} event${value === 1 ? "" : "s"}`, "Activity"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={26}>
                  {activityTimeline.map((d) => (
                    <Cell
                      key={d.date}
                      fill={d.isToday ? "var(--gold)" : "var(--primary)"}
                      fillOpacity={d.count === 0 ? 0.18 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Activity Records
          </CardTitle>
          <CardDescription>
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {" "}
            {auditLog.length} entries - sorted {sortAsc ? "oldest first" : "newest first"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search user, action, or detail..."
                  className="pl-9"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(v: "all" | AuditLogEntry["category"]) => setCategoryFilter(v)}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setSortAsc((s) => !s)}
                className="sm:w-auto"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortAsc ? "Oldest first" : "Newest first"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Date range:</span>
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDateRange(r.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    dateRange === r.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[34rem] overflow-y-auto scroll-thin rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-40">Timestamp</TableHead>
                  <TableHead className="w-44">User</TableHead>
                  <TableHead className="w-48">Action</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const sev = severityFor(entry.action);
                  const color = CATEGORY_COLORS[entry.category];
                  const { date, time } = splitTimestamp(entry.timestamp);
                  return (
                    <TableRow
                      key={entry.id}
                      className="hover:bg-primary/5!"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">{date}</span>
                          <span className="font-mono text-xs text-foreground/80">{time}</span>
                          <span className="mt-0.5 text-[10px] text-muted-foreground/70">
                            {daysAgoLabel(date, todayDate)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HexagonAvatar name={entry.user} color={color} size={24} />
                          <span className="text-sm font-medium text-foreground">{entry.user}</span>
                        </div>
                      </TableCell>
                      <TableCell>{actionBadge(entry.action, entry.category)}</TableCell>
                      <TableCell>{categoryBadge(entry.category)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5" title={sev.label}>
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: sev.color }}
                          />
                          <span className="text-[11px] text-muted-foreground">{sev.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.detail}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No audit entries match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Compliance &amp; Integrity</p>
          <p className="text-xs text-muted-foreground">
            Audit log entries are immutable and cannot be deleted or modified. Retained for compliance.
          </p>
        </div>
      </div>
    </div>
  );
}

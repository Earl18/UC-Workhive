import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const EXPORT_TEMP_DIR = path.join(process.cwd(), ".codex-exports");
const EMPLOYEE_MASTER_LIST_EXPORTER_SCRIPT = path.join(process.cwd(), "src", "lib", "exporters", "export_employee_master_list.py");
const ATTENDANCE_REPORT_EXPORTER_SCRIPT = path.join(process.cwd(), "src", "lib", "exporters", "export_attendance_report.py");
const ATTENDANCE_SUMMARY_EXPORTER_SCRIPT = path.join(process.cwd(), "src", "lib", "exporters", "export_attendance_summary.py");
const LEAVE_SUMMARY_EXPORTER_SCRIPT = path.join(process.cwd(), "src", "lib", "exporters", "export_leave_summary.py");
const BUNDLED_PYTHON = path.join(
  os.homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe",
);

export type EmployeeMasterListExportRow = {
  idNumber?: string;
  lastName: string;
  firstName: string;
  middleName: string;
  gender: string;
  department: string;
  position: string;
  dateHired: string;
  dateHiredDisplay: string;
  lengthOfService: string;
  age: number | null;
  employmentStatus: string;
  email: string;
  address: string;
  contactNumber: string;
  birthDate?: string;
  education: Array<{ level: "Bachelor" | "Master" | "Doctoral"; degree: string; school?: string; year?: string }>;
};

export type EmployeeMasterListExportPayload = {
  organizationName: string;
  campusAddress: string;
  reportTitle: string;
  classification: string;
  employees: EmployeeMasterListExportRow[];
};

export type AttendanceReportExportRow = {
  employeeName: string;
  position: string;
  dateLabel: string;
  day: string;
  morningIn: string;
  morningOut: string;
  afternoonIn: string;
  afternoonOut: string;
  workHours: string;
  late: string;
  undertime: string;
  overtime: string;
  remarks: string;
};

export type AttendanceReportExportPayload = {
  organizationName: string;
  campusAddress: string;
  reportTitle: string;
  classification: string;
  timeframeLabel: string;
  rows: AttendanceReportExportRow[];
};

export type AttendanceSummaryExportRow = {
  sequence: number;
  lastName: string;
  firstName: string;
  absent: string;
  leaveDays: string;
  late: string;
  undertime: string;
  overtime: string;
  remarks: string;
};

export type AttendanceSummaryExportPayload = {
  organizationName: string;
  campusAddress: string;
  reportTitle: string;
  classification: string;
  timeframeLabel: string;
  periodLabel: string;
  rows: AttendanceSummaryExportRow[];
};


export type LeaveSummaryExportRow = {
  sequence: number;
  lastName: string;
  firstName: string;
  middleName: string;
  position: string;
  employmentStatus: string;
  dateHired: string;
  vacationLeave: string;
  sickLeave: string;
  incentiveLeave: string;
  soloParent: string;
  paternity: string;
  maternity: string;
};

export type LeaveSummaryExportPayload = {
  organizationName: string;
  reportTitle: string;
  timeframeLabel: string;
  filtersLabel: string;
  rows: LeaveSummaryExportRow[];
};

function getPythonCandidates() {
  return [process.env.PYTHON_PATH, process.env.PYTHON, BUNDLED_PYTHON, "python", "py"].filter(Boolean) as string[];
}

async function ensureExportTempDir() {
  await fs.mkdir(EXPORT_TEMP_DIR, { recursive: true });
}

async function runExporter(scriptPath: string, inputPath: string, outputPath: string) {
  let lastError: unknown = null;

  for (const candidate of getPythonCandidates()) {
    try {
      await execFileAsync(candidate, [scriptPath, inputPath, outputPath], {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf8",
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to export workbook.");
}

export async function exportEmployeeMasterListWorkbook(payload: EmployeeMasterListExportPayload) {
  await ensureExportTempDir();
  const stamp = Date.now();
  const inputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-employee-master-list.json`);
  const outputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-employee-master-list.xlsx`);

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");
    await runExporter(EMPLOYEE_MASTER_LIST_EXPORTER_SCRIPT, inputPath, outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => undefined);
    await fs.unlink(outputPath).catch(() => undefined);
  }
}

export async function exportAttendanceReportWorkbook(payload: AttendanceReportExportPayload) {
  await ensureExportTempDir();
  const stamp = Date.now();
  const inputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-attendance-report.json`);
  const outputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-attendance-report.xlsx`);

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");
    await runExporter(ATTENDANCE_REPORT_EXPORTER_SCRIPT, inputPath, outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => undefined);
    await fs.unlink(outputPath).catch(() => undefined);
  }
}

export async function exportAttendanceSummaryWorkbook(payload: AttendanceSummaryExportPayload) {
  await ensureExportTempDir();
  const stamp = Date.now();
  const inputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-attendance-summary.json`);
  const outputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-attendance-summary.xlsx`);

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");
    await runExporter(ATTENDANCE_SUMMARY_EXPORTER_SCRIPT, inputPath, outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => undefined);
    await fs.unlink(outputPath).catch(() => undefined);
  }
}


export async function exportLeaveSummaryWorkbook(payload: LeaveSummaryExportPayload) {
  await ensureExportTempDir();
  const stamp = Date.now();
  const inputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-leave-summary.json`);
  const outputPath = path.join(EXPORT_TEMP_DIR, `${stamp}-leave-summary.xlsx`);

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");
    await runExporter(LEAVE_SUMMARY_EXPORTER_SCRIPT, inputPath, outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.unlink(inputPath).catch(() => undefined);
    await fs.unlink(outputPath).catch(() => undefined);
  }
}

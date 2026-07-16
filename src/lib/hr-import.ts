import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { DocumentRecord, EducationTier, Employee, StaffCategory } from "@/lib/types";

const execFileAsync = promisify(execFile);
const IMPORT_TEMP_DIR = path.join(process.cwd(), ".codex-imports");
const PARSER_SCRIPT = path.join(process.cwd(), "src", "lib", "importers", "parse_employment_status_workbook.py");
const BUNDLED_PYTHON = path.join(
  os.homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe",
);

export type ImportedEmployeeDraft = Omit<Employee, "id"> & {
  birthDate?: string;
  importRowNumber?: number;
  sourceSheet: string;
  sourceClassification: string;
  staffCategory: StaffCategory;
  education: EducationTier[];
  documents: DocumentRecord[];
};

export type ParsedWorkbookPayload = {
  sheetName: string;
  classification: string;
  staffCategory: StaffCategory;
  workbookType?: "employee-information" | "id-number";
  workbookTypeLabel?: string;
  workbookTypeReason?: string;
  records: ImportedEmployeeDraft[];
};

function getPythonCandidates() {
  return [process.env.PYTHON_PATH, process.env.PYTHON, BUNDLED_PYTHON, "python", "py"].filter(Boolean) as string[];
}

async function ensureImportTempDir() {
  await fs.mkdir(IMPORT_TEMP_DIR, { recursive: true });
}

async function runParser(filePath: string) {
  let lastError: unknown = null;

  for (const candidate of getPythonCandidates()) {
    try {
      const { stdout } = await execFileAsync(candidate, [PARSER_SCRIPT, filePath], {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf8",
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
      });
      return JSON.parse(stdout) as ParsedWorkbookPayload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to run Excel parser.");
}

export async function parseEmploymentStatusWorkbook(fileName: string, bytes: Buffer) {
  await ensureImportTempDir();
  const tempPath = path.join(IMPORT_TEMP_DIR, `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, "_")}`);

  try {
    await fs.writeFile(tempPath, bytes);
    return await runParser(tempPath);
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

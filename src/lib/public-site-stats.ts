import { db } from "@/lib/db";
import { JOB_POSTINGS } from "@/lib/mock-data";

export type PublicSiteStats = {
  employeeCount: number;
  departmentCount: number;
  activeJobPostingCount: number;
  holidayCount: number;
  yearLabel: string;
};

export async function getPublicSiteStats(): Promise<PublicSiteStats> {
  const yearLabel = String(new Date().getFullYear());

  const [employeeCount, departmentRows, holidayCount] = await Promise.all([
    db.employeeRecord.count(),
    db.employeeRecord.groupBy({ by: ["department"] }),
    db.holidayRecord.count(),
  ]);

  const departmentCount = departmentRows.filter((row) => row.department.trim().length > 0).length;

  return {
    employeeCount,
    departmentCount,
    activeJobPostingCount: JOB_POSTINGS.filter((job) => job.status === "Active").length,
    holidayCount,
    yearLabel,
  };
}

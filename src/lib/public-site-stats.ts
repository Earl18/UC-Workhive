import { db } from "@/lib/db";
import { getPublicJobPostings } from "@/lib/job-posting-data";

export type PublicSiteStats = {
  employeeCount: number;
  departmentCount: number;
  activeJobPostingCount: number;
  holidayCount: number;
  yearLabel: string;
};

export async function getPublicSiteStats(): Promise<PublicSiteStats> {
  const yearLabel = String(new Date().getFullYear());

  const [employeeCount, departmentRows, holidayCount, jobPostings] = await Promise.all([
    db.employeeRecord.count(),
    db.employeeRecord.groupBy({ by: ["department"] }),
    db.holidayRecord.count(),
    getPublicJobPostings(),
  ]);

  const departmentCount = departmentRows.filter((row) => row.department.trim().length > 0).length;
  const activeJobPostingCount = jobPostings.filter((job) => job.active).length;

  return {
    employeeCount,
    departmentCount,
    activeJobPostingCount,
    holidayCount,
    yearLabel,
  };
}

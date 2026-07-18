import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { JobPosting, JobPostingStatus, JobQualification, JobType } from "@/lib/types";

const DEFAULT_POSITION_TYPES = ["Full-Time", "Part-Time", "Contractual"] as const;
const JOB_TYPES = new Set<JobType>(DEFAULT_POSITION_TYPES);
const JOB_POSTING_AUTHOR_ID = "workhive-job-postings";

type StoredJobPosting = {
  kind: "job-posting";
  department: string;
  positionType: string;
  summary: string;
  qualifications: JobQualification[];
  postedAt: string;
  closesAt: string | null;
  applicantCount: number;
  creatorName: string;
};

export type JobPostingFormOptions = {
  departmentSuggestions: string[];
  positionTypeSuggestions: string[];
};

function normalizeJobType(value?: string): JobType | string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "Full-Time";
  }

  return JOB_TYPES.has(normalized as JobType) ? (normalized as JobType) : normalized;
}

function normalizeQualifications(value: unknown): JobQualification[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        const title = item.trim();
        return title ? { title, description: "" } : null;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const title = String(item.title ?? "").trim();
      const description = String(item.description ?? "").trim();
      if (!title && !description) {
        return null;
      }

      return { title, description };
    })
    .filter((item): item is JobQualification => Boolean(item));
}

function formatStatus(active: boolean): JobPostingStatus {
  return active ? "Active" : "Closed";
}

function parseStoredJobPosting(content: string | null): StoredJobPosting | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Partial<StoredJobPosting>;
    if (parsed.kind !== "job-posting") {
      return null;
    }

    const creatorName = String(parsed.creatorName ?? "").trim();
    if (!creatorName) {
      return null;
    }

    return {
      kind: "job-posting",
      department: String(parsed.department ?? "").trim(),
      positionType: String(parsed.positionType ?? "Full-Time").trim() || "Full-Time",
      summary: String(parsed.summary ?? "").trim(),
      qualifications: normalizeQualifications(parsed.qualifications),
      postedAt: String(parsed.postedAt ?? "").trim(),
      closesAt: parsed.closesAt ? String(parsed.closesAt).trim() : null,
      applicantCount: Number.isFinite(parsed.applicantCount) ? Number(parsed.applicantCount) : 0,
      creatorName,
    };
  } catch {
    return null;
  }
}

function toJobPosting(row: { id: string; title: string; published: boolean; content: string | null }): JobPosting | null {
  const stored = parseStoredJobPosting(row.content);
  if (!stored) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    department: stored.department,
    positionType: normalizeJobType(stored.positionType),
    summary: stored.summary,
    qualifications: stored.qualifications,
    postedAt: stored.postedAt,
    closesAt: stored.closesAt ?? undefined,
    active: row.published,
    applicantCount: stored.applicantCount,
    creatorName: stored.creatorName,
    description: stored.summary,
    requirements: stored.qualifications.map((item) => item.title),
    postedDate: stored.postedAt,
    deadline: stored.closesAt ?? undefined,
    status: formatStatus(row.published),
  };
}

function validateJobPostingInput(input: Partial<JobPosting>) {
  const title = input.title?.trim() ?? "";
  const department = input.department?.trim() ?? "";
  const summary = (input.summary ?? input.description)?.trim() ?? "";
  const positionType = normalizeJobType(typeof input.positionType === "string" ? input.positionType : "Full-Time");
  const qualifications = normalizeQualifications(input.qualifications ?? []);
  const postedAt = input.postedAt?.trim() || input.postedDate?.trim() || new Date().toISOString().slice(0, 10);
  const closesAt = input.closesAt?.trim() || input.deadline?.trim() || null;
  const active = typeof input.active === "boolean" ? input.active : input.status !== "Closed";
  const creatorName = input.creatorName?.trim() ?? "";

  if (!title) {
    throw new Error("Job title is required.");
  }
  if (!department) {
    throw new Error("Department is required.");
  }
  if (!summary) {
    throw new Error("Job summary is required.");
  }
  if (!positionType) {
    throw new Error("Position type is required.");
  }
  if (qualifications.length === 0) {
    throw new Error("Add at least one qualification row.");
  }
  if (qualifications.some((item) => !item.title.trim() || !item.description.trim())) {
    throw new Error("Each qualification needs both a title and a description.");
  }
  if (!creatorName) {
    throw new Error("Creator name is required.");
  }

  return {
    title,
    active,
    stored: JSON.stringify({
      kind: "job-posting",
      department,
      positionType,
      summary,
      qualifications,
      postedAt,
      closesAt,
      applicantCount: Number.isFinite(input.applicantCount) ? Number(input.applicantCount) : 0,
      creatorName,
    } satisfies StoredJobPosting),
  };
}

async function readJobPostingRows() {
  const rows = await db.post.findMany({
    where: { authorId: JOB_POSTING_AUTHOR_ID },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, title: true, published: true, content: true },
  });

  return rows
    .map(toJobPosting)
    .filter((job): job is JobPosting => Boolean(job))
    .sort((left, right) => (right.postedAt ?? "").localeCompare(left.postedAt ?? ""));
}

export async function getStaffJobPostings() {
  try {
    return await readJobPostingRows();
  } catch {
    return [];
  }
}

export async function getPublicJobPostings() {
  return getStaffJobPostings();
}

export async function getJobPostingById(id: string) {
  try {
    const row = await db.post.findFirst({
      where: { id, authorId: JOB_POSTING_AUTHOR_ID },
      select: { id: true, title: true, published: true, content: true },
    });
    return row ? toJobPosting(row) : null;
  } catch {
    return null;
  }
}

export async function getJobPostingFormOptions(): Promise<JobPostingFormOptions> {
  try {
    const [jobPostings, employeeDepartments] = await Promise.all([
      readJobPostingRows(),
      db.employeeRecord.findMany({
        select: { department: true },
        distinct: ["department"],
        orderBy: { department: "asc" },
      }),
    ]);

    const departmentSuggestions = Array.from(
      new Set(
        [
          ...jobPostings.map((job) => job.department.trim()),
          ...employeeDepartments.map((row) => row.department.trim()),
        ].filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    const positionTypeSuggestions = Array.from(
      new Set(
        [
          ...DEFAULT_POSITION_TYPES,
          ...jobPostings.map((job) => String(job.positionType).trim()),
        ].filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return {
      departmentSuggestions,
      positionTypeSuggestions,
    };
  } catch {
    return {
      departmentSuggestions: [],
      positionTypeSuggestions: [...DEFAULT_POSITION_TYPES],
    };
  }
}

export async function createJobPosting(input: Partial<JobPosting>) {
  const payload = validateJobPostingInput(input);
  const created = await db.post.create({
    data: {
      id: randomUUID(),
      title: payload.title,
      content: payload.stored,
      published: payload.active,
      authorId: JOB_POSTING_AUTHOR_ID,
    },
    select: { id: true, title: true, published: true, content: true },
  });

  const job = toJobPosting(created);
  if (!job) {
    throw new Error("Unable to create job posting.");
  }
  return job;
}

export async function updateJobPosting(id: string, input: Partial<JobPosting>) {
  const existing = await getJobPostingById(id);
  if (!existing) {
    throw new Error("Job posting not found.");
  }

  const payload = validateJobPostingInput({
    ...existing,
    ...input,
    creatorName: input.creatorName ?? existing.creatorName,
  });

  const updated = await db.post.update({
    where: { id },
    data: {
      title: payload.title,
      content: payload.stored,
      published: payload.active,
    },
    select: { id: true, title: true, published: true, content: true },
  });

  const job = toJobPosting(updated);
  if (!job) {
    throw new Error("Unable to update job posting.");
  }
  return job;
}

export async function deleteJobPosting(id: string) {
  const existing = await db.post.findFirst({
    where: { id, authorId: JOB_POSTING_AUTHOR_ID },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Job posting not found.");
  }

  await db.post.delete({
    where: { id },
  });
}

export async function setJobPostingActiveState(id: string, active: boolean) {
  const updated = await db.post.update({
    where: { id },
    data: { published: active },
    select: { id: true, title: true, published: true, content: true },
  });

  const job = toJobPosting(updated);
  if (!job) {
    throw new Error("Unable to update job posting.");
  }
  return job;
}


import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Applicant, ApplicantStage, ApplicantStageHistoryEntry, InterviewSchedule } from "@/lib/types";

type StoredJobPosting = {
  kind: "job-posting";
  department: string;
  positionType: string;
  summary: string;
  qualifications: Array<{ title: string; description: string }>;
  postedAt: string;
  closesAt: string | null;
  applicantCount: number;
  creatorName: string;
};

type StoredApplicantSubmission = {
  kind: "applicant-submission";
  fullName: string;
  email: string;
  contact: string;
  message: string;
  sssNumber: string;
  tinNumber: string;
  pagIbigNumber: string;
  philHealthNumber: string;
  jobId: string;
  positionApplied: string;
  department: string;
  stage: ApplicantStage;
  submittedAt: string;
  appliedDate: string;
  requirements: NonNullable<Applicant["requirements"]>;
  requirementsArchiveName: string;
  requirementsArchiveBucket: string;
  requirementsArchivePath: string;
  stageHistory?: ApplicantStageHistoryEntry[];
  schedule?: Applicant["schedule"];
};

const JOB_POSTING_AUTHOR_ID = "workhive-job-postings";
const APPLICATION_AUTHOR_ID = "workhive-applications";
const APPLICANT_STAGES: ApplicantStage[] = ["New", "Screening", "Interview", "Offer", "Hired", "Rejected"];

function normalizeApplicantStage(value: unknown): ApplicantStage {
  return APPLICANT_STAGES.includes(value as ApplicantStage) ? (value as ApplicantStage) : "New";
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

    return {
      kind: "job-posting",
      department: String(parsed.department ?? "").trim(),
      positionType: String(parsed.positionType ?? "").trim(),
      summary: String(parsed.summary ?? "").trim(),
      qualifications: Array.isArray(parsed.qualifications)
        ? parsed.qualifications.filter((item): item is { title: string; description: string } => Boolean(item && typeof item === "object"))
        : [],
      postedAt: String(parsed.postedAt ?? "").trim(),
      closesAt: parsed.closesAt ? String(parsed.closesAt).trim() : null,
      applicantCount: Number.isFinite(parsed.applicantCount) ? Number(parsed.applicantCount) : 0,
      creatorName: String(parsed.creatorName ?? "").trim(),
    };
  } catch {
    return null;
  }
}

function toMinutes(time: string) {
  const [hourString, minuteString] = time.split(":");
  return (Number(hourString) * 60) + Number(minuteString);
}

function addHours(time: string, hours: number) {
  const [hourString, minuteString] = time.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return "10:00";
  }

  const totalMinutes = Math.min((hour * 60) + minute + (hours * 60), (23 * 60) + 59);
  const nextHour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nextMinute = String(totalMinutes % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}

function getScheduleRange(schedule: InterviewSchedule) {
  const startTime = schedule.startTime ?? String(schedule.time ?? "09:00").split(" - ")[0]?.trim() ?? "09:00";
  const endTime = schedule.endTime ?? String(schedule.time ?? "09:00").split(" - ")[1]?.trim() ?? addHours(startTime, 1);
  return { startTime, endTime };
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

function parseStageHistory(value: unknown): ApplicantStageHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const stage = normalizeApplicantStage((entry as { stage?: unknown }).stage);
      const movedBy = String((entry as { movedBy?: unknown }).movedBy ?? "").trim();
      const movedAt = String((entry as { movedAt?: unknown }).movedAt ?? "").trim();

      if (!movedBy || !movedAt) {
        return null;
      }

      return { stage, movedBy, movedAt } satisfies ApplicantStageHistoryEntry;
    })
    .filter((entry): entry is ApplicantStageHistoryEntry => Boolean(entry));
}

function parseStoredApplicantSubmission(content: string | null): StoredApplicantSubmission | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Partial<StoredApplicantSubmission>;
    if (parsed.kind !== "applicant-submission") {
      return null;
    }

    return {
      kind: "applicant-submission",
      fullName: String(parsed.fullName ?? "").trim(),
      email: String(parsed.email ?? "").trim(),
      contact: String(parsed.contact ?? "").trim(),
      message: String(parsed.message ?? "").trim(),
      sssNumber: String(parsed.sssNumber ?? "").trim(),
      tinNumber: String(parsed.tinNumber ?? "").trim(),
      pagIbigNumber: String(parsed.pagIbigNumber ?? "").trim(),
      philHealthNumber: String(parsed.philHealthNumber ?? "").trim(),
      jobId: String(parsed.jobId ?? "").trim(),
      positionApplied: String(parsed.positionApplied ?? "").trim(),
      department: String(parsed.department ?? "").trim(),
      stage: normalizeApplicantStage(parsed.stage),
      submittedAt: String(parsed.submittedAt ?? "").trim(),
      appliedDate: String(parsed.appliedDate ?? "").trim(),
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements.filter(Boolean) as NonNullable<Applicant["requirements"]> : [],
      requirementsArchiveName: String(parsed.requirementsArchiveName ?? "").trim(),
      requirementsArchiveBucket: String(parsed.requirementsArchiveBucket ?? "").trim(),
      requirementsArchivePath: String(parsed.requirementsArchivePath ?? "").trim(),
      stageHistory: parseStageHistory(parsed.stageHistory),
      schedule: parsed.schedule,
    };
  } catch {
    return null;
  }
}

function toApplicant(row: { id: string; content: string | null }): Applicant | null {
  const parsed = parseStoredApplicantSubmission(row.content);
  if (!parsed) {
    return null;
  }

  return {
    id: row.id,
    fullName: parsed.fullName,
    name: parsed.fullName,
    email: parsed.email,
    phone: parsed.contact,
    contact: parsed.contact,
    sssNumber: parsed.sssNumber,
    tinNumber: parsed.tinNumber,
    pagIbigNumber: parsed.pagIbigNumber,
    philHealthNumber: parsed.philHealthNumber,
    positionApplied: parsed.positionApplied,
    department: parsed.department,
    jobId: parsed.jobId,
    stage: parsed.stage,
    submittedAt: parsed.submittedAt,
    appliedDate: parsed.appliedDate,
    message: parsed.message,
    requirementsArchiveName: parsed.requirementsArchiveName,
    requirementsArchiveBucket: parsed.requirementsArchiveBucket,
    requirementsArchivePath: parsed.requirementsArchivePath,
    requirements: parsed.requirements,
    stageHistory: parsed.stageHistory,
    schedule: parsed.schedule,
  } satisfies Applicant;
}

async function getApplicantRowById(applicantId: string) {
  return db.post.findFirst({
    where: { id: applicantId, authorId: APPLICATION_AUTHOR_ID },
    select: { id: true, content: true },
  });
}

export async function submitApplicantApplication(input: {
  fullName: string;
  email: string;
  contact: string;
  message?: string;
  sssNumber: string;
  tinNumber: string;
  pagIbigNumber: string;
  philHealthNumber: string;
  jobId: string;
  requirements: NonNullable<Applicant["requirements"]>;
  requirementsArchiveName: string;
  requirementsArchiveBucket: string;
  requirementsArchivePath: string;
}) {
  const applicantId = `app-${randomUUID()}`;
  const submittedAt = new Date().toISOString();
  const appliedDate = submittedAt.slice(0, 10);

  const applicant = await db.$transaction(async (tx) => {
    const jobRow = await tx.post.findFirst({
      where: { id: input.jobId, authorId: JOB_POSTING_AUTHOR_ID },
      select: { id: true, title: true, published: true, content: true },
    });

    if (!jobRow) {
      throw new Error("Job posting not found.");
    }

    if (!jobRow.published) {
      throw new Error("This job posting is no longer accepting applications.");
    }

    const jobPosting = parseStoredJobPosting(jobRow.content);
    if (!jobPosting) {
      throw new Error("Job posting details are incomplete.");
    }

    const storedApplicant = {
      kind: "applicant-submission",
      fullName: input.fullName,
      email: input.email,
      contact: input.contact,
      message: input.message?.trim() ?? "",
      sssNumber: input.sssNumber,
      tinNumber: input.tinNumber,
      pagIbigNumber: input.pagIbigNumber,
      philHealthNumber: input.philHealthNumber,
      jobId: jobRow.id,
      positionApplied: jobRow.title,
      department: jobPosting.department,
      stage: "New",
      submittedAt,
      appliedDate,
      requirements: input.requirements,
      requirementsArchiveName: input.requirementsArchiveName,
      requirementsArchiveBucket: input.requirementsArchiveBucket,
      requirementsArchivePath: input.requirementsArchivePath,
      stageHistory: [],
    } satisfies StoredApplicantSubmission;

    await tx.post.create({
      data: {
        id: applicantId,
        title: input.fullName,
        authorId: APPLICATION_AUTHOR_ID,
        published: true,
        content: JSON.stringify(storedApplicant),
      },
    });

    await tx.post.update({
      where: { id: jobRow.id },
      data: {
        content: JSON.stringify({
          ...jobPosting,
          applicantCount: (jobPosting.applicantCount ?? 0) + 1,
        } satisfies StoredJobPosting),
      },
    });

    return toApplicant({ id: applicantId, content: JSON.stringify(storedApplicant) });
  });

  if (!applicant) {
    throw new Error("Unable to create applicant record.");
  }

  return applicant;
}

export async function getSubmittedApplicants() {
  try {
    const rows = await db.post.findMany({
      where: { authorId: APPLICATION_AUTHOR_ID },
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true },
    });

    return rows.map(toApplicant).filter((item): item is Applicant => Boolean(item));
  } catch {
    return [];
  }
}

export async function getSubmittedApplicantById(applicantId: string) {
  const row = await getApplicantRowById(applicantId);
  if (!row) {
    return null;
  }

  return toApplicant(row);
}

export async function updateSubmittedApplicantStage(input: {
  applicantId: string;
  stage: ApplicantStage;
  movedBy: string;
}) {
  const row = await getApplicantRowById(input.applicantId);

  if (!row) {
    throw new Error("Applicant not found.");
  }

  const parsed = parseStoredApplicantSubmission(row.content);
  if (!parsed) {
    throw new Error("Applicant record is invalid.");
  }

  const movedAt = new Date().toISOString();
  const nextStageHistory = [
    ...(parsed.stageHistory ?? []).filter((entry) => entry.stage !== input.stage),
    { stage: input.stage, movedBy: input.movedBy, movedAt },
  ];

  const updated = {
    ...parsed,
    stage: input.stage,
    stageHistory: nextStageHistory,
  } satisfies StoredApplicantSubmission;

  await db.post.update({
    where: { id: input.applicantId },
    data: { content: JSON.stringify(updated) },
  });

  const applicant = toApplicant({ id: input.applicantId, content: JSON.stringify(updated) });
  if (!applicant) {
    throw new Error("Unable to update applicant stage.");
  }

  return applicant;
}

export async function updateSubmittedApplicantSchedule(input: {
  applicantId: string;
  schedule: Applicant["schedule"];
}) {
  const row = await getApplicantRowById(input.applicantId);

  if (!row) {
    throw new Error("Applicant not found.");
  }

  const parsed = parseStoredApplicantSubmission(row.content);
  if (!parsed) {
    throw new Error("Applicant record is invalid.");
  }

  const nextSchedule = input.schedule as InterviewSchedule | undefined;
  if (!nextSchedule?.date || !nextSchedule.startTime || !nextSchedule.endTime) {
    throw new Error("Interview schedule is incomplete.");
  }

  if (toMinutes(nextSchedule.endTime) <= toMinutes(nextSchedule.startTime)) {
    throw new Error("Interview end time must be later than the start time.");
  }

  const interviewerName = nextSchedule.createdBy ?? nextSchedule.panel?.[0] ?? "";
  if (!interviewerName) {
    throw new Error("Interviewer is required.");
  }

  const existingRows = await db.post.findMany({
    where: { authorId: APPLICATION_AUTHOR_ID },
    select: { id: true, content: true },
  });

  for (const existingRow of existingRows) {
    if (existingRow.id === input.applicantId) {
      continue;
    }

    const existingApplicant = toApplicant(existingRow);
    const existingSchedule = existingApplicant?.schedule as InterviewSchedule | undefined;
    if (!existingSchedule?.date) {
      continue;
    }

    const existingInterviewer = existingSchedule.createdBy ?? existingSchedule.panel?.[0] ?? "";
    if (existingInterviewer !== interviewerName || existingSchedule.date !== nextSchedule.date) {
      continue;
    }

    const existingRange = getScheduleRange(existingSchedule);
    if (rangesOverlap(nextSchedule.startTime, nextSchedule.endTime, existingRange.startTime, existingRange.endTime)) {
      throw new Error(`This time range overlaps with another interview already booked by ${interviewerName}.`);
    }
  }

  const updated = {
    ...parsed,
    stage: "Interview",
    schedule: {
      ...nextSchedule,
      time: `${nextSchedule.startTime} - ${nextSchedule.endTime}`,
      createdBy: interviewerName,
      panel: [interviewerName],
    },
  } satisfies StoredApplicantSubmission;

  await db.post.update({
    where: { id: input.applicantId },
    data: { content: JSON.stringify(updated) },
  });

  const applicant = toApplicant({ id: input.applicantId, content: JSON.stringify(updated) });
  if (!applicant) {
    throw new Error("Unable to update applicant schedule.");
  }

  return applicant;
}

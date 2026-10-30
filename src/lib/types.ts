// WorkHive data types mirrors a normalized Postgres/Supabase schema.

export type Role = "employee" | "hr" | "admin";

export type EmploymentStatus = "Regular" | "Probationary" | "Retired" | "Resigned";
export type Gender = "Male" | "Female";
export type StaffCategory = "Teaching" | "Non-Teaching";

export type EducationTier = {
  level: "Bachelor" | "Master" | "Doctoral";
  degree: string;
  school: string;
  year?: string;
};

export type DocumentRecord = {
  id: string;
  employeeId: string;
  type:
    | "Diploma"
    | "Certificate"
    | "PRC License"
    | "Training Certificate"
    | "COE"
    | "Clearance"
    | "Other";
  fileName: string;
  uploadDate: string;
  status: "Verified" | "Pending" | "Rejected";
  label?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageBucket?: string;
  storagePath?: string;
};

export type Employee = {
  id: string;
  idNumber?: string;
  lastName: string;
  firstName: string;
  middleName: string;
  gender: Gender;
  department: string;
  position: string;
  accountRole?: Extract<Role, "employee" | "hr">;
  staffCategory?: StaffCategory;
  dateHired: string;
  employmentStatus: EmploymentStatus;
  email: string;
  address: string;
  contactNumber: string;
  education: EducationTier[];
  documents: DocumentRecord[];
  avatarColor?: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  sourceEmployeeName?: string;
  date: string;
  day: string;
  morningIn?: string | null;
  morningOut?: string | null;
  afternoonIn?: string | null;
  afternoonOut?: string | null;
  timeIn: string | null;
  timeOut: string | null;
  scheduledIn: string;
  scheduledOut: string;
  remarks: string;
  workHoursHrs?: number;
  workHoursMin?: number;
  lateMin: number;
  undertimeMin: number;
  overtimeHrs: number;
  overtimeStatus?: "Not Required" | "Pending" | "Approved" | "Rejected";
  approvedOvertimeHrs?: number;
  validationFlags?: AttendanceValidationFlag[];
  validationStatus?: "Pending" | "Resolved";
  overtimeDecisionBy?: string | null;
  overtimeDecisionAt?: string | null;
  overtimeDecisionNote?: string | null;
  deletedAt?: string | null;
  deletedByName?: string | null;
};

export type AttendanceValidationFlag =
  | "EMPLOYEE_NOT_FOUND"
  | "APPROVED_LEAVE_HAS_ATTENDANCE"
  | "OVERTIME_REQUIRES_CONFIRMATION"
  | "HOLIDAY_ATTENDANCE_REQUIRES_VALIDATION"
  | "MISSING_LUNCH_OUT"
  | "MISSING_AFTERNOON_IN"
  | "ONLY_TIME_IN"
  | "ONLY_TIME_OUT"
  | "MISSING_MORNING_IN"
  | "INCOMPLETE_PUNCHES"
  | "POSSIBLE_HALF_DAY";

export type LeaveType =
  | "Vacation Leave"
  | "Sick Leave"
  | "Incentive Leave"
  | "Solo Parent Leave"
  | "Paternity Leave"
  | "Maternity Leave"
  | "Leave W/O Pay";

export const NURSING_SUMMER_INCENTIVE_DEPARTMENT = "College of Nursing" as const;

export const LEAVE_TYPES = [
  "Vacation Leave",
  "Sick Leave",
  "Incentive Leave",
  "Solo Parent Leave",
  "Paternity Leave",
  "Maternity Leave",
  "Leave W/O Pay",
] as const;

export function isSummerIncentiveDepartment(department?: string | null) {
  return (department ?? "").trim().toLowerCase() === NURSING_SUMMER_INCENTIVE_DEPARTMENT.toLowerCase();
}

export function getLeaveTypeLabel(leaveType: LeaveType, department?: string | null) {
  if (leaveType === "Incentive Leave") {
    return isSummerIncentiveDepartment(department) ? "Summer Incentive Leave" : "Incentive Leave";
  }

  return leaveType;
}

export function isLeaveTypeApplicableToEmployee(leaveType: LeaveType, options?: { department?: string | null; gender?: Gender | null }) {
  if (leaveType === "Incentive Leave") {
    return isSummerIncentiveDepartment(options?.department);
  }

  if (leaveType === "Paternity Leave") {
    return options?.gender === "Male";
  }

  if (leaveType === "Maternity Leave") {
    return options?.gender === "Female";
  }

  return true;
}

export function getAdminLeaveTypeLabel(leaveType: LeaveType) {
  if (leaveType === "Incentive Leave") {
    return "Summer Incentive Leave (College of Nursing only)";
  }

  if (leaveType === "Leave W/O Pay") {
    return "Leave W/O Pay (Unlimited)";
  }

  return leaveType;
}

export function getAvailableLeaveTypes(department?: string | null, gender?: Gender | null) {
  return LEAVE_TYPES.filter((leaveType) => isLeaveTypeApplicableToEmployee(leaveType, { department, gender }));
}

export const LEAVE_APPLICATION_TYPES = [
  "Maternity",
  "Paternity",
  "Vacation",
  "Sick w/ pay under UC",
  "Sick w/ pay under SSS",
  "Emergency leave w/pay",
  "Leave of absence w/o pay",
] as const;
export type LeaveCredits = {
  employeeId: string;
  vacationLeave: number;
  sickLeave: number;
  incentiveLeave: number;
  soloParent: number;
  paternity: number;
  maternity: number;
  leaveWithoutPay: number;
};

export type LeaveStage = "HR Approval" | "Immediate Superior" | "Next Level Superior" | "HRD/Accounting";
export type LeaveStageStatus = "Pending" | "Approved" | "Disapproved";

export type LeaveApprovalStage = {
  stage: LeaveStage;
  status: LeaveStageStatus;
  approverName?: string;
  reason?: string;
  dateSigned?: string;
};

export type LeaveRequestAttachment = {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  storageBucket?: string;
  storagePath?: string;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  dateFrom: string;
  dateTo: string;
  days: number;
  isHalfDay?: boolean;
  reason: string;
  dateFiled: string;
  attachment?: LeaveRequestAttachment;
  stages: LeaveApprovalStage[];
  currentStageIndex: number;
  overallStatus: "Pending" | "Approved" | "Disapproved" | "Cancelled";
};

export type HolidayType = "Regular Holiday" | "Special Non-Working Day" | "Special Working Holiday" | "Institution Holiday";
export type Holiday = {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
};

export type JobType = "Full-Time" | "Part-Time" | "Contractual";
export type JobPostingStatus = "Active" | "Closed";

export type JobQualification = {
  title: string;
  description: string;
};

export type JobPosting = {
  id: string;
  title: string;
  department: string;
  positionType: JobType | string;
  summary?: string;
  qualifications?: JobQualification[];
  postedAt?: string;
  closesAt?: string;
  active?: boolean;
  applicantCount?: number;
  creatorName?: string;
  description?: string;
  requirements?: string[];
  postedDate?: string;
  deadline?: string;
  status?: JobPostingStatus;
};

export type ApplicantStage = "New" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";

export type ApplicantStageHistoryEntry = {
  stage: ApplicantStage;
  movedBy: string;
  movedAt: string;
};

export type InterviewMode = "Onsite" | "Online";

export type InterviewSchedule = {
  id?: string;
  date: string;
  status?: "Scheduled" | "Done";
  time: string;
  startTime?: string;
  endTime?: string;
  mode: InterviewMode;
  venueOrLink: string;
  panel: string[];
  interviewer?: string;
  platform?: string;
  location?: string;
  rescheduled?: boolean;
  previousDate?: string;
  createdBy?: string;
  moderatorUserId?: string;
};

export type InterviewScore = {
  applicantId: string;
  positionApplied?: string;
  department?: string;
  evaluator: string;
  criteria: Record<string, number> | Array<{ key: string; label: string; score: number; remarks: string }>;
  remarks?: string;
  recommendation?: "Highly Recommended" | "Recommended" | "Recommended with Reservation" | "Not Recommended";
  totalScore?: number;
  interviewer?: string;
  date?: string;
};

export type InterviewEvaluation = {
  interviewerId: string;
  interviewerName: string;
  date: string;
  criteria: Record<string, { score: number | null; remarks: string }>;
  overallRemarks: string;
  status: "draft" | "submitted";
  totalScore: number | null;
  recommendation: "Highly Recommended" | "Recommended" | "Recommended with Reservation" | "Not Recommended" | null;
  updatedAt: string;
};

export type Applicant = {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  phone?: string;
  contact?: string;
  sssNumber?: string;
  tinNumber?: string;
  pagIbigNumber?: string;
  philHealthNumber?: string;
  positionApplied?: string;
  department?: string;
  jobId?: string;
  stage: ApplicantStage;
  resumeFile?: string;
  submittedAt?: string;
  appliedDate?: string;
  message?: string;
  requirementsArchiveName?: string;
  requirementsArchiveBucket?: string;
  requirementsArchivePath?: string;
  requirements?: {
    key: string;
    label: string;
    submitted: boolean;
  }[];
  stageHistory?: ApplicantStageHistoryEntry[];
  schedule?: InterviewSchedule;
  scores?: InterviewScore[];
  interviewScore?: InterviewScore;
  interviewEvaluation?: InterviewEvaluation;
};

export type SystemUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: string;
  department?: string;
  active: boolean;
  lastLogin?: string;
  mustChangePassword?: boolean;
};

export type CoreEmailTemplateType =
    | "Leave Approved"
    | "Leave Rejected"
    | "Job Application Received"
    | "Interview Invitation"
    | "Interview Rescheduled"
    | "Overtime Approved"
    | "Overtime Rejected"
    | "Upcoming Holiday Reminder"
    | "Welcome Email"
    | "Password Reset";

export type EmailTemplateType = CoreEmailTemplateType | (string & {});

export type EmailTemplate = {
  type: EmailTemplateType;
  subject: string;
  body: string;
};

export type FeatureToggles = {
  employeeDashboard: boolean;
  employeeProfile: boolean;
  employeeTimeClock: boolean;
  employeeAttendanceHistory: boolean;
  employeeLeave: boolean;
  employeeHolidays: boolean;
  employeeDocuments: boolean;
  employeeNotifications: boolean;
  hrDashboard: boolean;
  hrEmployees: boolean;
  hrAttendanceReport: boolean;
  hrAttendanceValidation: boolean;
  hrAttendanceSummary: boolean;
  hrTardiness: boolean;
  hrLeaveManagement: boolean;
  hrLeaveSummary: boolean;
  hrJobPostings: boolean;
  hrApplications: boolean;
  hrInterviewScheduling: boolean;
  hrInterviews: boolean;
  hrVideoConferencing: boolean;
  hrHolidays: boolean;
  hrReports: boolean;
};

export type GeofenceZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  color: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  category: "Auth" | "Employee" | "Attendance" | "Leave" | "Recruitment" | "System";
  detail: string;
};

export type NotificationItem = {
  id: string;
  role: Role | "all";
  employeeId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "leave" | "overtime" | "interview" | "holiday" | "attendance" | "recruitment" | "system";
};

export const APPLICANT_REQUIREMENT_KEYS = [
  "Resume",
  "TOR",
  "Diploma",
  "PRC License",
  "COE",
  "SSS/PhilHealth/PagIBIG",
  "Marriage/Birth Certificate",
] as const;

export const INTERVIEW_CRITERIA = [
  "Communication",
  "Content Knowledge",
  "Personality",
  "Teaching Demo",
  "Experience",
  "Critical Thinking",
  "Professionalism",
  "Subject Mastery",
  "Technology Use",
  "Self-Management",
] as const;

export const DEPARTMENTS = [
  "College of Computer Studies",
  "College of Business & Accountancy",
  "HR Department",
  "College of Engineering",
  "College of Nursing",
  "Finance & Accounting",
  "College of Education",
  "IT Department",
  "College of Arts & Sciences",
  "College of Tourism & Hospitality",
  "Basic Education Department",
  "Library & Learning Resources",
  "Registrar's Office",
  "Student Affairs",
] as const;







// WorkHive mock data — realistic, varied sample values mirroring the
// normalized schema. This is the seed for the in-memory data store.

import {
  Employee,
  AttendanceRecord,
  LeaveCredits,
  LeaveRequest,
  Holiday,
  JobPosting,
  Applicant,
  SystemUser,
  EmailTemplate,
  GeofenceZone,
  AuditLogEntry,
  NotificationItem,
  FeatureToggles,
  APPLICANT_REQUIREMENT_KEYS,
  INTERVIEW_CRITERIA,
  InterviewScore,
} from "./types";

const AVATAR_COLORS = [
  "#1e3a8a", "#1d4ed8", "#0e7490", "#0f766e", "#b45309",
  "#92400e", "#7c2d12", "#5b21b6", "#1e40af", "#075985",
];

export const EMPLOYEES: Employee[] = [
  {
    id: "emp-001",
    lastName: "Dela Cruz",
    firstName: "Maria",
    middleName: "Santos",
    gender: "Female",
    department: "College of Computer Studies",
    position: "Instructor I",
    dateHired: "2019-08-15",
    employmentStatus: "Regular",
    email: "maria.delacruz@uc.edu.ph",
    address: "123 Mabini St, Cebu City",
    contactNumber: "0917-123-4567",
    avatarColor: AVATAR_COLORS[0],
    education: [
      { level: "Bachelor", degree: "BS Information Technology", school: "University of Cebu", year: "2018" },
      { level: "Master", degree: "Master of Science in Computer Science", school: "Cebu Institute of Technology", year: "2022" },
    ],
    documents: [
      { id: "doc-001", employeeId: "emp-001", type: "Diploma", fileName: "BSIT_Diploma.pdf", uploadDate: "2019-08-10", status: "Verified" },
      { id: "doc-002", employeeId: "emp-001", type: "PRC License", fileName: "PRC_Lic_2024.pdf", uploadDate: "2024-01-15", status: "Verified" },
      { id: "doc-003", employeeId: "emp-001", type: "Training Certificate", fileName: "AWS_Cert.pdf", uploadDate: "2024-03-20", status: "Pending" },
    ],
  },
  {
    id: "emp-002",
    lastName: "Reyes",
    firstName: "Juan",
    middleName: "Lim",
    gender: "Male",
    department: "College of Business & Accountancy",
    position: "Assistant Professor II",
    dateHired: "2016-06-01",
    employmentStatus: "Regular",
    email: "juan.reyes@uc.edu.ph",
    address: "456 Jones Ave, Cebu City",
    contactNumber: "0917-234-5678",
    avatarColor: AVATAR_COLORS[1],
    education: [
      { level: "Bachelor", degree: "BS Accountancy", school: "University of San Carlos", year: "2014" },
      { level: "Master", degree: "Master of Business Administration", school: "University of Cebu", year: "2019" },
      { level: "Doctoral", degree: "Doctor of Business Administration (cand.)", school: "Silliman University" },
    ],
    documents: [
      { id: "doc-004", employeeId: "emp-002", type: "Diploma", fileName: "MBA_Diploma.pdf", uploadDate: "2019-07-01", status: "Verified" },
      { id: "doc-005", employeeId: "emp-002", type: "Certificate", fileName: "CPA_License.pdf", uploadDate: "2016-05-20", status: "Verified" },
    ],
  },
  {
    id: "emp-003",
    lastName: "Tan",
    firstName: "Sophia",
    middleName: "Garcia",
    gender: "Female",
    department: "HR Department",
    position: "HR Officer",
    dateHired: "2020-01-10",
    employmentStatus: "Regular",
    email: "sophia.tan@uc.edu.ph",
    address: "78 Gorordo Ave, Cebu City",
    contactNumber: "0917-345-6789",
    avatarColor: AVATAR_COLORS[2],
    education: [
      { level: "Bachelor", degree: "BS Psychology", school: "University of the Philippines Cebu", year: "2019" },
      { level: "Master", degree: "Master of Business Administration", school: "University of Cebu", year: "2023" },
    ],
    documents: [
      { id: "doc-006", employeeId: "emp-003", type: "Diploma", fileName: "BSPsych_Diploma.pdf", uploadDate: "2020-01-05", status: "Verified" },
    ],
  },
  {
    id: "emp-004",
    lastName: "Mendoza",
    firstName: "Carlos",
    middleName: "Bautista",
    gender: "Male",
    department: "College of Engineering",
    position: "Instructor III",
    dateHired: "2021-09-01",
    employmentStatus: "Probationary",
    email: "carlos.mendoza@uc.edu.ph",
    address: "12 Nasipit Rd, Talamban, Cebu City",
    contactNumber: "0917-456-7890",
    avatarColor: AVATAR_COLORS[3],
    education: [
      { level: "Bachelor", degree: "BS Civil Engineering", school: "University of San Carlos", year: "2020" },
    ],
    documents: [
      { id: "doc-007", employeeId: "emp-004", type: "PRC License", fileName: "CE_License.pdf", uploadDate: "2021-08-25", status: "Verified" },
      { id: "doc-008", employeeId: "emp-004", type: "Diploma", fileName: "BSCE_Diploma.pdf", uploadDate: "2021-08-25", status: "Pending" },
    ],
  },
  {
    id: "emp-005",
    lastName: "Villanueva",
    firstName: "Anna",
    middleName: "Cruz",
    gender: "Female",
    department: "College of Nursing",
    position: "Clinical Instructor II",
    dateHired: "2018-02-12",
    employmentStatus: "Regular",
    email: "anna.villanueva@uc.edu.ph",
    address: "34 Banawa, Cebu City",
    contactNumber: "0917-567-8901",
    avatarColor: AVATAR_COLORS[4],
    education: [
      { level: "Bachelor", degree: "BS Nursing", school: "Cebu Doctors' University", year: "2017" },
      { level: "Master", degree: "Master of Arts in Nursing", school: "Silliman University", year: "2022" },
    ],
    documents: [
      { id: "doc-009", employeeId: "emp-005", type: "PRC License", fileName: "RN_License.pdf", uploadDate: "2018-02-01", status: "Verified" },
    ],
  },
  {
    id: "emp-006",
    lastName: "Ocampo",
    firstName: "Rafael",
    middleName: "Domingo",
    gender: "Male",
    department: "Finance & Accounting",
    position: "Accountant II",
    dateHired: "2017-07-15",
    employmentStatus: "Regular",
    email: "rafael.ocampo@uc.edu.ph",
    address: "56 A.S. Fortuna, Mandaue City",
    contactNumber: "0917-678-9012",
    avatarColor: AVATAR_COLORS[5],
    education: [
      { level: "Bachelor", degree: "BS Accountancy", school: "University of Cebu", year: "2016" },
    ],
    documents: [
      { id: "doc-010", employeeId: "emp-006", type: "Certificate", fileName: "CPA_Board.pdf", uploadDate: "2017-07-01", status: "Verified" },
    ],
  },
  {
    id: "emp-007",
    lastName: "Bautista",
    firstName: "Elena",
    middleName: "Reyes",
    gender: "Female",
    department: "College of Education",
    position: "Associate Professor",
    dateHired: "2013-06-01",
    employmentStatus: "Regular",
    email: "elena.bautista@uc.edu.ph",
    address: "78 Mango Ave, Cebu City",
    contactNumber: "0917-789-0123",
    avatarColor: AVATAR_COLORS[6],
    education: [
      { level: "Bachelor", degree: "BSEd English", school: "University of San Carlos", year: "2012" },
      { level: "Master", degree: "Master of Arts in Education", school: "University of the Philippines", year: "2018" },
      { level: "Doctoral", degree: "PhD in Educational Leadership", school: "Cebu Normal University", year: "2023" },
    ],
    documents: [
      { id: "doc-011", employeeId: "emp-007", type: "Diploma", fileName: "PhD_Diploma.pdf", uploadDate: "2023-05-30", status: "Verified" },
    ],
  },
  {
    id: "emp-008",
    lastName: "Fernandez",
    firstName: "Mark",
    middleName: "Tan",
    gender: "Male",
    department: "IT Department",
    position: "Systems Developer",
    dateHired: "2022-03-14",
    employmentStatus: "Probationary",
    email: "mark.fernandez@uc.edu.ph",
    address: "90 Labangon, Cebu City",
    contactNumber: "0917-890-1234",
    avatarColor: AVATAR_COLORS[7],
    education: [
      { level: "Bachelor", degree: "BS Computer Science", school: "University of Cebu", year: "2021" },
    ],
    documents: [
      { id: "doc-012", employeeId: "emp-008", type: "Diploma", fileName: "BSCS_Diploma.pdf", uploadDate: "2022-03-01", status: "Verified" },
      { id: "doc-013", employeeId: "emp-008", type: "Training Certificate", fileName: "Azure_Fundamentals.pdf", uploadDate: "2023-11-10", status: "Pending" },
    ],
  },
  {
    id: "emp-009",
    lastName: "Gonzales",
    firstName: "Patricia",
    middleName: "Lim",
    gender: "Female",
    department: "College of Arts & Sciences",
    position: "Instructor II",
    dateHired: "2019-11-05",
    employmentStatus: "Regular",
    email: "patricia.gonzales@uc.edu.ph",
    address: "23 Guadalupe, Cebu City",
    contactNumber: "0917-901-2345",
    avatarColor: AVATAR_COLORS[8],
    education: [
      { level: "Bachelor", degree: "AB Communication", school: "University of the Philippines Cebu", year: "2018" },
      { level: "Master", degree: "Master of Arts in Communication", school: "Ateneo de Manila", year: "2024" },
    ],
    documents: [
      { id: "doc-014", employeeId: "emp-009", type: "Diploma", fileName: "MA_Comm.pdf", uploadDate: "2024-06-15", status: "Pending" },
    ],
  },
  {
    id: "emp-010",
    lastName: "Santos",
    firstName: "Roberto",
    middleName: "Cruz",
    gender: "Male",
    department: "College of Tourism & Hospitality",
    position: "Instructor I",
    dateHired: "2023-01-09",
    employmentStatus: "Probationary",
    email: "roberto.santos@uc.edu.ph",
    address: "67 Tisa, Cebu City",
    contactNumber: "0917-012-3456",
    avatarColor: AVATAR_COLORS[9],
    education: [
      { level: "Bachelor", degree: "BS Hospitality Management", school: "University of Cebu", year: "2022" },
    ],
    documents: [
      { id: "doc-015", employeeId: "emp-010", type: "Diploma", fileName: "BSHM_Diploma.pdf", uploadDate: "2023-01-03", status: "Verified" },
    ],
  },
  {
    id: "emp-011",
    lastName: "Lim",
    firstName: "Christine",
    middleName: "Wong",
    gender: "Female",
    department: "Basic Education Department",
    position: "Senior High School Teacher",
    dateHired: "2015-08-01",
    employmentStatus: "Regular",
    email: "christine.lim@uc.edu.ph",
    address: "11 Apas, Cebu City",
    contactNumber: "0918-111-2222",
    avatarColor: AVATAR_COLORS[0],
    education: [
      { level: "Bachelor", degree: "BSEd Mathematics", school: "Cebu Normal University", year: "2014" },
      { level: "Master", degree: "Master of Arts in Education (Math)", school: "University of San Carlos", year: "2021" },
    ],
    documents: [
      { id: "doc-016", employeeId: "emp-011", type: "Certificate", fileName: "LET_License.pdf", uploadDate: "2015-07-20", status: "Verified" },
    ],
  },
  {
    id: "emp-012",
    lastName: "Aquino",
    firstName: "Daniel",
    middleName: "Fernandez",
    gender: "Male",
    department: "Library & Learning Resources",
    position: "Head Librarian",
    dateHired: "2014-05-12",
    employmentStatus: "Regular",
    email: "daniel.aquino@uc.edu.ph",
    address: "88 Mabolo, Cebu City",
    contactNumber: "0918-222-3333",
    avatarColor: AVATAR_COLORS[1],
    education: [
      { level: "Bachelor", degree: "BLIS", school: "University of the Philippines", year: "2013" },
      { level: "Master", degree: "Master of Library Science", school: "University of the Philippines", year: "2019" },
    ],
    documents: [
      { id: "doc-017", employeeId: "emp-012", type: "Diploma", fileName: "MLS_Diploma.pdf", uploadDate: "2019-06-01", status: "Verified" },
    ],
  },
  {
    id: "emp-013",
    lastName: "Ramos",
    firstName: "Isabel",
    middleName: "Ocampo",
    gender: "Female",
    department: "Registrar's Office",
    position: "Registrar Staff",
    dateHired: "2020-09-21",
    employmentStatus: "Regular",
    email: "isabel.ramos@uc.edu.ph",
    address: "44 Lahug, Cebu City",
    contactNumber: "0918-333-4444",
    avatarColor: AVATAR_COLORS[2],
    education: [
      { level: "Bachelor", degree: "BS Office Administration", school: "University of Cebu", year: "2019" },
    ],
    documents: [],
  },
  {
    id: "emp-014",
    lastName: "Cruz",
    firstName: "Jonathan",
    middleName: "Dela Peña",
    gender: "Male",
    department: "Student Affairs",
    position: "Guidance Counselor",
    dateHired: "2018-10-08",
    employmentStatus: "Regular",
    email: "jonathan.cruz@uc.edu.ph",
    address: "22 Capitol Site, Cebu City",
    contactNumber: "0918-444-5555",
    avatarColor: AVATAR_COLORS[3],
    education: [
      { level: "Bachelor", degree: "AB Psychology", school: "University of San Carlos", year: "2017" },
      { level: "Master", degree: "MA Guidance & Counseling", school: "Cebu Normal University", year: "2022" },
    ],
    documents: [
      { id: "doc-018", employeeId: "emp-014", type: "Certificate", fileName: "RGC_License.pdf", uploadDate: "2022-08-10", status: "Verified" },
    ],
  },
  {
    id: "emp-015",
    lastName: "Mercado",
    firstName: "Lucia",
    middleName: "Tan",
    gender: "Female",
    department: "College of Education",
    position: "Instructor I",
    dateHired: "2022-08-15",
    employmentStatus: "Probationary",
    email: "lucia.mercado@uc.edu.ph",
    address: "99 Punta Princesa, Cebu City",
    contactNumber: "0918-555-6666",
    avatarColor: AVATAR_COLORS[4],
    education: [
      { level: "Bachelor", degree: "BSEd Filipino", school: "Cebu Normal University", year: "2021" },
    ],
    documents: [],
  },
];

// Generate realistic attendance for the last ~20 working days per employee.
function generateAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date("2025-04-15");
  let counter = 1;
  for (const emp of EMPLOYEES) {
    const isTeaching = !["HR Department", "Finance & Accounting", "IT Department", "Registrar's Office"].includes(emp.department);
    const schedIn = isTeaching ? "07:30" : "08:00";
    const schedOut = isTeaching ? "16:30" : "17:00";
    for (let i = 0; i < 22; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dow = d.getDay();
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
      const isWeekend = dow === 0 || dow === 6;
      // Some holidays in the range
      const holidayMap: Record<string, string> = {
        "2025-04-09": "Araw ng Kagitingan (Regular Holiday)",
        "2025-04-17": "Maundy Thursday (Regular Holiday)",
        "2025-04-18": "Good Friday (Regular Holiday)",
      };
      if (holidayMap[dateStr]) {
        records.push({
          id: `att-${counter++}`,
          employeeId: emp.id,
          date: dateStr,
          day: dayName,
          timeIn: null,
          timeOut: null,
          scheduledIn: schedIn,
          scheduledOut: schedOut,
          remarks: holidayMap[dateStr].includes("Regular") ? "RH" : "SH",
          lateMin: 0,
          undertimeMin: 0,
          overtimeHrs: 0,
        });
        continue;
      }
      if (isWeekend) {
        records.push({
          id: `att-${counter++}`,
          employeeId: emp.id,
          date: dateStr,
          day: dayName,
          timeIn: null,
          timeOut: null,
          scheduledIn: schedIn,
          scheduledOut: schedOut,
          remarks: "Weekend",
          lateMin: 0,
          undertimeMin: 0,
          overtimeHrs: 0,
        });
        continue;
      }
      // Randomized but realistic
      const rnd = Math.random();
      let lateMin = 0;
      let timeIn = schedIn;
      let undertimeMin = 0;
      let timeOut = schedOut;
      let overtimeHrs = 0;
      let remarks = "Present";
      let overtimeStatus: AttendanceRecord["overtimeStatus"] | undefined;
      if (rnd < 0.08) {
        // absent
        records.push({
          id: `att-${counter++}`,
          employeeId: emp.id,
          date: dateStr,
          day: dayName,
          timeIn: null,
          timeOut: null,
          scheduledIn: schedIn,
          scheduledOut: schedOut,
          remarks: "Absent",
          lateMin: 0,
          undertimeMin: 0,
          overtimeHrs: 0,
        });
        continue;
      }
      if (rnd < 0.25) {
        // late
        lateMin = 5 + Math.floor(Math.random() * 40);
        const [h, m] = schedIn.split(":").map(Number);
        const total = h * 60 + m + lateMin;
        timeIn = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      } else if (rnd < 0.32) {
        const [h, m] = schedIn.split(":").map(Number);
        const early = Math.floor(Math.random() * 10);
        const total = h * 60 + m - early;
        timeIn = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      }
      if (rnd < 0.15) {
        undertimeMin = 15 + Math.floor(Math.random() * 60);
        remarks = "Half Day";
        const [h, m] = schedOut.split(":").map(Number);
        const total = h * 60 + m - undertimeMin;
        timeOut = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      } else if (rnd > 0.85) {
        overtimeHrs = Math.round((Math.random() * 2 + 0.5) * 10) / 10;
        const [h, m] = schedOut.split(":").map(Number);
        const total = h * 60 + m + Math.round(overtimeHrs * 60);
        timeOut = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        overtimeStatus = i < 3 ? "Pending" : Math.random() > 0.4 ? "Approved" : "Rejected";
      }
      records.push({
        id: `att-${counter++}`,
        employeeId: emp.id,
        date: dateStr,
        day: dayName,
        timeIn,
        timeOut,
        scheduledIn: schedIn,
        scheduledOut: schedOut,
        remarks,
        lateMin,
        undertimeMin,
        overtimeHrs,
        overtimeStatus,
      });
    }
  }
  return records;
}

export const ATTENDANCE: AttendanceRecord[] = generateAttendance();

export const LEAVE_CREDITS: LeaveCredits[] = EMPLOYEES.map((e, i) => ({
  employeeId: e.id,
  vacationLeave: 10 + ((i * 3) % 6),
  sickLeave: 8 + ((i * 2) % 5),
  incentiveLeave: 3 + (i % 2),
  soloParent: i % 4 === 0 ? 7 : 0,
  paternity: e.gender === "Male" ? 7 : 0,
  maternity: e.gender === "Female" ? 60 : 0,
  leaveWithoutPay: (i % 3) * 2,
}));

export const LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "lv-001",
    employeeId: "emp-001",
    leaveType: "Vacation Leave",
    dateFrom: "2025-04-22",
    dateTo: "2025-04-23",
    days: 2,
    reason: "Family vacation in Bohol",
    dateFiled: "2025-04-10",
    stages: [
      { stage: "Immediate Superior", status: "Approved", approverName: "Dept Head", dateSigned: "2025-04-11" },
      { stage: "Next Level Superior", status: "Approved", approverName: "Dean", dateSigned: "2025-04-12" },
      { stage: "HRD/Accounting", status: "Pending" },
    ],
    currentStageIndex: 2,
    overallStatus: "Pending",
  },
  {
    id: "lv-002",
    employeeId: "emp-004",
    leaveType: "Sick Leave",
    dateFrom: "2025-04-14",
    dateTo: "2025-04-14",
    days: 1,
    reason: "Fever and flu",
    dateFiled: "2025-04-13",
    stages: [
      { stage: "Immediate Superior", status: "Approved", approverName: "Dept Head", dateSigned: "2025-04-13" },
      { stage: "Next Level Superior", status: "Pending" },
      { stage: "HRD/Accounting", status: "Pending" },
    ],
    currentStageIndex: 1,
    overallStatus: "Pending",
  },
  {
    id: "lv-003",
    employeeId: "emp-005",
    leaveType: "Maternity Leave",
    dateFrom: "2025-05-01",
    dateTo: "2025-06-29",
    days: 60,
    reason: "Maternity leave (expected delivery May 2025)",
    dateFiled: "2025-04-01",
    stages: [
      { stage: "Immediate Superior", status: "Approved", approverName: "Dean", dateSigned: "2025-04-02" },
      { stage: "Next Level Superior", status: "Approved", approverName: "VP Academic", dateSigned: "2025-04-03" },
      { stage: "HRD/Accounting", status: "Approved", approverName: "HR Officer", dateSigned: "2025-04-05" },
    ],
    currentStageIndex: 3,
    overallStatus: "Approved",
  },
  {
    id: "lv-004",
    employeeId: "emp-009",
    leaveType: "Sick Leave",
    dateFrom: "2025-04-10",
    dateTo: "2025-04-10",
    days: 1,
    reason: "Dental appointment",
    dateFiled: "2025-04-08",
    stages: [
      { stage: "Immediate Superior", status: "Approved", approverName: "Dept Head", dateSigned: "2025-04-08" },
      { stage: "Next Level Superior", status: "Approved", approverName: "Dean", dateSigned: "2025-04-09" },
      { stage: "HRD/Accounting", status: "Approved", approverName: "HR Officer", dateSigned: "2025-04-09" },
    ],
    currentStageIndex: 3,
    overallStatus: "Approved",
  },
  {
    id: "lv-005",
    employeeId: "emp-010",
    leaveType: "Vacation Leave",
    dateFrom: "2025-04-28",
    dateTo: "2025-04-30",
    days: 3,
    reason: "Personal matters",
    dateFiled: "2025-04-12",
    stages: [
      { stage: "Immediate Superior", status: "Disapproved", approverName: "Dept Head", reason: "Conflict with finals week coverage", dateSigned: "2025-04-13" },
      { stage: "Next Level Superior", status: "Pending" },
      { stage: "HRD/Accounting", status: "Pending" },
    ],
    currentStageIndex: 0,
    overallStatus: "Disapproved",
  },
  {
    id: "lv-006",
    employeeId: "emp-002",
    leaveType: "Incentive Leave",
    dateFrom: "2025-05-05",
    dateTo: "2025-05-05",
    days: 1,
    reason: "Birthday incentive leave",
    dateFiled: "2025-04-14",
    stages: [
      { stage: "Immediate Superior", status: "Pending" },
      { stage: "Next Level Superior", status: "Pending" },
      { stage: "HRD/Accounting", status: "Pending" },
    ],
    currentStageIndex: 0,
    overallStatus: "Pending",
  },
];

export const HOLIDAYS: Holiday[] = [
  { id: "hol-2025-001", name: "New Year's Day", date: "2025-01-01", type: "Regular Holiday" },
  { id: "hol-2025-002", name: "Chinese New Year", date: "2025-01-29", type: "Special Non-Working Day" },
  { id: "hol-2025-003", name: "Cebu Charter Day", date: "2025-02-24", type: "Special Non-Working Day" },
  { id: "hol-2025-004", name: "EDSA People Power Revolution Anniversary", date: "2025-02-25", type: "Special Working Holiday" },
  { id: "hol-2025-005", name: "Eid'l Fitr", date: "2025-04-01", type: "Regular Holiday" },
  { id: "hol-2025-006", name: "Araw ng Kagitingan", date: "2025-04-09", type: "Regular Holiday" },
  { id: "hol-2025-007", name: "Maundy Thursday", date: "2025-04-17", type: "Regular Holiday" },
  { id: "hol-2025-008", name: "Good Friday", date: "2025-04-18", type: "Regular Holiday" },
  { id: "hol-2025-009", name: "Black Saturday", date: "2025-04-19", type: "Special Non-Working Day" },
  { id: "hol-2025-010", name: "Labor Day", date: "2025-05-01", type: "Regular Holiday" },
  { id: "hol-2025-011", name: "Independence Day", date: "2025-06-12", type: "Regular Holiday" },
  { id: "hol-2025-012", name: "UC South Campus Foundation Day", date: "2025-08-15", type: "Special Working Holiday" },
  { id: "hol-2025-013", name: "Ninoy Aquino Day", date: "2025-08-21", type: "Special Non-Working Day" },
  { id: "hol-2025-014", name: "National Heroes Day", date: "2025-08-25", type: "Regular Holiday" },
  { id: "hol-2025-015", name: "All Saints' Day", date: "2025-11-01", type: "Special Non-Working Day" },
  { id: "hol-2025-016", name: "Bonifacio Day", date: "2025-11-30", type: "Regular Holiday" },
  { id: "hol-2025-017", name: "Christmas Day", date: "2025-12-25", type: "Regular Holiday" },
  { id: "hol-2025-018", name: "Rizal Day", date: "2025-12-30", type: "Regular Holiday" },
  { id: "hol-2025-019", name: "Last Day of the Year", date: "2025-12-31", type: "Special Non-Working Day" },

  { id: "hol-2026-001", name: "New Year's Day", date: "2026-01-01", type: "Regular Holiday" },
  { id: "hol-2026-002", name: "Chinese New Year", date: "2026-02-17", type: "Special Non-Working Day" },
  { id: "hol-2026-003", name: "EDSA People Power Revolution Anniversary", date: "2026-02-25", type: "Special Working Holiday" },
  { id: "hol-2026-004", name: "Eid'l Fitr", date: "2026-03-20", type: "Regular Holiday" },
  { id: "hol-2026-005", name: "Maundy Thursday", date: "2026-04-02", type: "Regular Holiday" },
  { id: "hol-2026-006", name: "Good Friday", date: "2026-04-03", type: "Regular Holiday" },
  { id: "hol-2026-007", name: "Black Saturday", date: "2026-04-04", type: "Special Non-Working Day" },
  { id: "hol-2026-008", name: "Araw ng Kagitingan", date: "2026-04-09", type: "Regular Holiday" },
  { id: "hol-2026-009", name: "Labor Day", date: "2026-05-01", type: "Regular Holiday" },
  { id: "hol-2026-010", name: "Independence Day", date: "2026-06-12", type: "Regular Holiday" },
  { id: "hol-2026-011", name: "UC South Campus Foundation Day", date: "2026-08-15", type: "Special Working Holiday" },
  { id: "hol-2026-012", name: "Ninoy Aquino Day", date: "2026-08-21", type: "Special Non-Working Day" },
  { id: "hol-2026-013", name: "National Heroes Day", date: "2026-08-31", type: "Regular Holiday" },
  { id: "hol-2026-014", name: "All Saints' Day", date: "2026-11-01", type: "Special Non-Working Day" },
  { id: "hol-2026-015", name: "All Souls' Day", date: "2026-11-02", type: "Special Non-Working Day" },
  { id: "hol-2026-016", name: "Bonifacio Day", date: "2026-11-30", type: "Regular Holiday" },
  { id: "hol-2026-017", name: "Feast of the Immaculate Conception", date: "2026-12-08", type: "Special Non-Working Day" },
  { id: "hol-2026-018", name: "Christmas Eve", date: "2026-12-24", type: "Special Non-Working Day" },
  { id: "hol-2026-019", name: "Christmas Day", date: "2026-12-25", type: "Regular Holiday" },
  { id: "hol-2026-020", name: "Rizal Day", date: "2026-12-30", type: "Regular Holiday" },
  { id: "hol-2026-021", name: "Last Day of the Year", date: "2026-12-31", type: "Special Non-Working Day" },
];

export const JOB_POSTINGS: JobPosting[] = [
  {
    id: "job-001",
    title: "College Instructor — Computer Studies",
    department: "College of Computer Studies",
    positionType: "Full-Time",
    description:
      "We are seeking a passionate Computer Studies Instructor to teach undergraduate courses in programming, data structures, and web development. The candidate will contribute to curriculum development and student research mentorship.",
    requirements: [
      "UC Application Form",
      "Application Letter",
      "Resume/CV",
      "3pcs 2x2 photo",
      "Transcript of Records",
      "Diploma",
      "Recommendation Letters",
      "Form 2316",
      "SSN/TIN/PAG-IBIG/PhilHealth",
      "PRC License",
      "Medical/Dental/Psych results",
      "Employee Info Updater",
      "UC Email Account Form",
    ],
    deadline: "2025-05-30",
    postedDate: "2025-04-01",
    status: "Active",
    applicantCount: 4,
  },
  {
    id: "job-002",
    title: "HR Assistant",
    department: "HR Department",
    positionType: "Full-Time",
    description:
      "The HR Assistant supports recruitment, employee records management, timekeeping, and benefits administration. Excellent interpersonal and organizational skills required.",
    requirements: [
      "UC Application Form",
      "Application Letter",
      "Resume/CV",
      "3pcs 2x2 photo",
      "Transcript of Records",
      "Diploma",
      "Recommendation Letters",
      "NBI/Police Clearance",
      "Medical/Dental/Psych results",
      "Employee Info Updater",
      "UC Email Account Form",
    ],
    deadline: "2025-05-15",
    postedDate: "2025-04-05",
    status: "Active",
    applicantCount: 3,
  },
  {
    id: "job-003",
    title: "Clinical Instructor — Nursing",
    department: "College of Nursing",
    positionType: "Full-Time",
    description:
      "Clinical Instructor for nursing students in affiliated hospitals. Must be a Registered Nurse with clinical and teaching experience. Responsibilities include clinical supervision and skills lab instruction.",
    requirements: [
      "UC Application Form",
      "Application Letter",
      "Resume/CV",
      "3pcs 2x2 photo",
      "Transcript of Records",
      "Diploma",
      "Recommendation Letters",
      "PRC License",
      "Medical/Dental/Psych results",
      "Employee Info Updater",
      "UC Email Account Form",
    ],
    deadline: "2025-06-10",
    postedDate: "2025-04-08",
    status: "Active",
    applicantCount: 2,
  },
  {
    id: "job-004",
    title: "Senior High School Teacher — STEM",
    department: "Basic Education Department",
    positionType: "Full-Time",
    description:
      "SHS Teacher specializing in STEM track (Mathematics/Physics). LET passer required. Will handle Grades 11–12 specialized subjects and act as class adviser.",
    requirements: [
      "UC Application Form",
      "Application Letter",
      "Resume/CV",
      "3pcs 2x2 photo",
      "Transcript of Records",
      "Diploma",
      "Recommendation Letters",
      "PRC License",
      "Medical/Dental/Psych results",
      "Employee Info Updater",
      "UC Email Account Form",
    ],
    deadline: "2025-05-20",
    postedDate: "2025-04-10",
    status: "Active",
    applicantCount: 5,
  },
  {
    id: "job-005",
    title: "Accountant II",
    department: "Finance & Accounting",
    positionType: "Full-Time",
    description:
      "CPA with experience in educational institution accounting. Handles payroll, government remittances, and financial reporting.",
    requirements: [
      "UC Application Form",
      "Application Letter",
      "Resume/CV",
      "3pcs 2x2 photo",
      "Transcript of Records",
      "Diploma",
      "Recommendation Letters",
      "Form 2316",
      "SSN/TIN/PAG-IBIG/PhilHealth",
      "Former Employee Clearance/COE",
      "NBI/Police Clearance",
      "Medical/Dental/Psych results",
      "Employee Info Updater",
      "UC Email Account Form",
    ],
    deadline: "2025-04-30",
    postedDate: "2025-03-15",
    status: "Closed",
    applicantCount: 6,
  },
];

function buildRequirements(allKeys: string[], submittedKeys: string[]) {
  return allKeys.map((k) => ({ key: k, label: k, submitted: submittedKeys.includes(k) }));
}

export const APPLICANTS: Applicant[] = [
  {
    id: "app-001",
    jobId: "job-001",
    name: "Angela Ponce",
    email: "angela.ponce@gmail.com",
    phone: "0919-111-2222",
    appliedDate: "2025-04-12",
    stage: "Interview",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "UC Application Form", "Application Letter", "Resume/CV", "3pcs 2x2 photo",
      "Transcript of Records", "Diploma", "Recommendation Letters", "PRC License",
      "Medical/Dental/Psych results",
    ]),
    schedule: {
      id: "sch-001",
      date: "2025-04-22",
      time: "10:00",
      interviewer: "Maria Dela Cruz",
      platform: "Video Conferencing",
    },
    interviewScore: undefined,
  },
  {
    id: "app-002",
    jobId: "job-001",
    name: "Bryan Uy",
    email: "bryan.uy@gmail.com",
    phone: "0919-222-3333",
    appliedDate: "2025-04-13",
    stage: "Screening",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "UC Application Form", "Application Letter", "Resume/CV", "Transcript of Records",
    ]),
  },
  {
    id: "app-003",
    jobId: "job-001",
    name: "Carmen Lopez",
    email: "carmen.lopez@gmail.com",
    phone: "0919-333-4444",
    appliedDate: "2025-04-14",
    stage: "New",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "Application Letter", "Resume/CV",
    ]),
  },
  {
    id: "app-004",
    jobId: "job-001",
    name: "Diego Salazar",
    email: "diego.salazar@gmail.com",
    phone: "0919-444-5555",
    appliedDate: "2025-04-15",
    stage: "Interview",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "UC Application Form", "Application Letter", "Resume/CV", "3pcs 2x2 photo",
      "Transcript of Records", "Diploma", "Recommendation Letters", "PRC License",
      "NBI/Police Clearance", "Medical/Dental/Psych results",
    ]),
    schedule: {
      id: "sch-002",
      date: "2025-04-23",
      time: "14:00",
      interviewer: "Juan Reyes",
      platform: "Face-to-Face",
      location: "HR Office, Room 201, Main Building",
    },
  },
  {
    id: "app-005",
    jobId: "job-002",
    name: "Erika Sy",
    email: "erika.sy@gmail.com",
    phone: "0919-555-6666",
    appliedDate: "2025-04-11",
    stage: "Offer",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "UC Application Form", "Application Letter", "Resume/CV", "3pcs 2x2 photo",
      "Transcript of Records", "Diploma", "Recommendation Letters", "NBI/Police Clearance",
      "Medical/Dental/Psych results", "Employee Info Updater", "UC Email Account Form",
    ]),
  },
  {
    id: "app-006",
    jobId: "job-002",
    name: "Francis Tan",
    email: "francis.tan@gmail.com",
    phone: "0919-666-7777",
    appliedDate: "2025-04-12",
    stage: "Screening",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "Application Letter", "Resume/CV", "Transcript of Records",
    ]),
  },
  {
    id: "app-007",
    jobId: "job-002",
    name: "Grace Montenegro",
    email: "grace.m@gmail.com",
    phone: "0919-777-8888",
    appliedDate: "2025-04-14",
    stage: "New",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "Application Letter", "Resume/CV",
    ]),
  },
  {
    id: "app-008",
    jobId: "job-003",
    name: "Hannah Cruz",
    email: "hannah.cruz@gmail.com",
    phone: "0919-888-9999",
    appliedDate: "2025-04-10",
    stage: "Interview",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "UC Application Form", "Application Letter", "Resume/CV", "3pcs 2x2 photo",
      "Transcript of Records", "Diploma", "PRC License", "Medical/Dental/Psych results",
    ]),
    schedule: {
      id: "sch-003",
      date: "2025-04-24",
      time: "09:00",
      interviewer: "Anna Villanueva",
      platform: "Video Conferencing",
    },
  },
  {
    id: "app-009",
    jobId: "job-003",
    name: "Ivan Reyes",
    email: "ivan.reyes@gmail.com",
    phone: "0919-999-0000",
    appliedDate: "2025-04-13",
    stage: "Screening",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "Application Letter", "Resume/CV", "Transcript of Records", "Diploma",
    ]),
  },
  {
    id: "app-010",
    jobId: "job-004",
    name: "Jasmine Lim",
    email: "jasmine.lim@gmail.com",
    phone: "0920-111-2222",
    appliedDate: "2025-04-09",
    stage: "Hired",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [...APPLICANT_REQUIREMENT_KEYS]),
    interviewScore: {
      applicantId: "app-010",
      positionApplied: "Senior High School Teacher — STEM",
      department: "Basic Education Department",
      date: "2025-04-18",
      criteria: INTERVIEW_CRITERIA.map((label, idx) => ({
        key: label,
        label,
        score: [5, 4, 5, 4, 4, 5, 5, 4, 5, 4][idx],
        remarks: ["Excellent", "Good", "Excellent", "Good", "Good", "Excellent", "Excellent", "Good", "Excellent", "Good"][idx],
      })),
      totalScore: 90,
      recommendation: "Highly Recommended",
      interviewer: "Christine Lim",
    } as InterviewScore,
  },
  {
    id: "app-011",
    jobId: "job-004",
    name: "Kevin Ong",
    email: "kevin.ong@gmail.com",
    phone: "0920-222-3333",
    appliedDate: "2025-04-11",
    stage: "Rejected",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "Application Letter", "Resume/CV",
    ]),
    interviewScore: {
      applicantId: "app-011",
      positionApplied: "Senior High School Teacher — STEM",
      department: "Basic Education Department",
      date: "2025-04-16",
      criteria: INTERVIEW_CRITERIA.map((label, idx) => ({
        key: label,
        label,
        score: [2, 2, 3, 2, 1, 2, 3, 2, 2, 2][idx],
        remarks: ["Below avg", "Below avg", "Average", "Below avg", "Poor", "Below avg", "Average", "Below avg", "Below avg", "Below avg"][idx],
      })),
      totalScore: 42,
      recommendation: "Recommended with Reservation",
      interviewer: "Christine Lim",
    } as InterviewScore,
  },
  {
    id: "app-012",
    jobId: "job-004",
    name: "Lorraine Tan",
    email: "lorraine.tan@gmail.com",
    phone: "0920-333-4444",
    appliedDate: "2025-04-12",
    stage: "Interview",
    requirements: buildRequirements([...APPLICANT_REQUIREMENT_KEYS], [
      "UC Application Form", "Application Letter", "Resume/CV", "Transcript of Records",
      "Diploma", "PRC License", "Medical/Dental/Psych results",
    ]),
    schedule: {
      id: "sch-004",
      date: "2025-04-25",
      time: "13:30",
      interviewer: "Christine Lim",
      platform: "Video Conferencing",
    },
  },
];

export const SYSTEM_USERS: SystemUser[] = [
  { id: "usr-001", name: "Maria Dela Cruz", email: "maria.delacruz@uc.edu.ph", role: "employee", employeeId: "emp-001", active: true, lastLogin: "2025-04-15 08:02" },
  { id: "usr-002", name: "Juan Reyes", email: "juan.reyes@uc.edu.ph", role: "employee", employeeId: "emp-002", active: true, lastLogin: "2025-04-15 07:48" },
  { id: "usr-003", name: "Sophia Tan", email: "sophia.tan@uc.edu.ph", role: "hr", employeeId: "emp-003", active: true, lastLogin: "2025-04-15 08:15" },
  { id: "usr-004", name: "Carlos Mendoza", email: "carlos.mendoza@uc.edu.ph", role: "employee", employeeId: "emp-004", active: true, lastLogin: "2025-04-14 16:50" },
  { id: "usr-005", name: "System Administrator", email: "admin@uc.edu.ph", role: "admin", active: true, lastLogin: "2025-04-15 09:01" },
  { id: "usr-006", name: "Anna Villanueva", email: "anna.villanueva@uc.edu.ph", role: "employee", employeeId: "emp-005", active: true, lastLogin: "2025-04-15 07:55" },
  { id: "usr-007", name: "Rafael Ocampo", email: "rafael.ocampo@uc.edu.ph", role: "employee", employeeId: "emp-006", active: true, lastLogin: "2025-04-15 08:10" },
  { id: "usr-008", name: "Mark Fernandez", email: "mark.fernandez@uc.edu.ph", role: "employee", employeeId: "emp-008", active: false },
  { id: "usr-009", name: "Patricia Gonzales", email: "patricia.gonzales@uc.edu.ph", role: "employee", employeeId: "emp-009", active: true, lastLogin: "2025-04-15 08:30" },
];

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    type: "Leave Approved",
    subject: "Your Leave Application Has Been Approved",
    body: "Dear [Employee Name],\n\nWe are pleased to inform you that your [Leave Type] application from [Date From] to [Date To] has been approved at all approval stages.\n\nPlease ensure proper turnover of your classes/duties before your leave begins.\n\nThank you,\nUC South Campus — Human Resource Department",
  },
  {
    type: "Leave Rejected",
    subject: "Update on Your Leave Application",
    body: "Dear [Employee Name],\n\nYour [Leave Type] application from [Date From] to [Date To] was not approved.\n\nReason: [Reason]\n\nIf you have questions, please contact the HR Office.\n\nUC South Campus — Human Resource Department",
  },
  {
    type: "Job Application Received",
    subject: "Application Received — [Position]",
    body: "Dear [Applicant Name],\n\nThank you for applying for the [Position] position at University of Cebu – South Campus. We have received your application and will review it shortly.\n\nYou will hear from us within 5–7 business days.\n\nUC South Campus — HR Recruitment",
  },
  {
    type: "Interview Invitation",
    subject: "Interview Invitation — [Position]",
    body: "Dear [Applicant Name],\n\nYou have been shortlisted for the [Position] position. Your interview is scheduled on:\n\nDate: [Date]\nTime: [Time]\nPlatform: [Platform]\n[Location/Link]\n\nPlease confirm your attendance.\n\nUC South Campus — HR Recruitment",
  },
  {
    type: "Interview Rescheduled",
    subject: "Interview Rescheduled — [Position]",
    body: "Dear [Applicant Name],\n\nYour interview for the [Position] position has been rescheduled to:\n\nDate: [New Date]\nTime: [New Time]\nPlatform: [Platform]\n\nWe apologize for any inconvenience.\n\nUC South Campus — HR Recruitment",
  },
  {
    type: "Overtime Approved",
    subject: "Overtime Request Approved",
    body: "Dear [Employee Name],\n\nYour overtime request for [Date] ([Hours] hrs) has been approved and will be reflected in your attendance records.\n\nUC South Campus — HR Department",
  },
  {
    type: "Overtime Rejected",
    subject: "Overtime Request Update",
    body: "Dear [Employee Name],\n\nYour overtime request for [Date] was not approved.\n\nReason: [Reason]\n\nUC South Campus — HR Department",
  },
  {
    type: "Upcoming Holiday Reminder",
    subject: "Upcoming Holiday Reminder: [Holiday Name]",
    body: "Dear [Employee Name],\n\nThis is a reminder that [Holiday Name] on [Date] is a [Holiday Type]. No classes/work on this day.\n\nPlease plan accordingly.\n\nUC South Campus — HR Department",
  },
  {
    type: "Welcome Email",
    subject: "Welcome to UC South Campus!",
    body: "Dear [Employee Name],\n\nWelcome to the WorkHive family at University of Cebu – South Campus! Your account has been created.\n\nLogin at workhive.uc.edu.ph using your UC email.\n\nUC South Campus — HR Department",
  },
  {
    type: "Password Reset",
    subject: "Password Reset Request",
    body: "Dear [User],\n\nWe received a request to reset your WorkHive password. Click the link below to proceed:\n\n[Reset Link]\n\nIf you did not request this, please ignore this email.\n\nUC South Campus — IT Department",
  },
];

export const FEATURE_TOGGLES: FeatureToggles = {
  employeeDashboard: true,
  employeeProfile: true,
  employeeTimeClock: true,
  employeeAttendanceHistory: true,
  employeeLeave: true,
  employeeHolidays: true,
  employeeDocuments: true,
  employeeNotifications: true,
  hrDashboard: true,
  hrEmployees: true,
  hrAttendanceReport: true,
  hrAttendanceValidation: true,
  hrAttendanceSummary: true,
  hrTardiness: true,
  hrLeaveManagement: true,
  hrLeaveSummary: true,
  hrJobPostings: true,
  hrApplications: true,
  hrInterviewScheduling: true,
  hrInterviews: true,
  hrVideoConferencing: true,
  hrHolidays: true,
  hrReports: true,
};

export const GEOFENCE_ZONES: GeofenceZone[] = [
  { id: "zone-001", name: "Main Building (UC South)", lat: 10.293, lng: 123.882, radius: 120, color: "#1e3a8a" },
  { id: "zone-002", name: "Annex Building", lat: 10.2945, lng: 123.8835, radius: 80, color: "#f59e0b" },
  { id: "zone-003", name: "Gymnasium / Activity Center", lat: 10.292, lng: 123.8805, radius: 100, color: "#0e7490" },
];

export const AUDIT_LOG: AuditLogEntry[] = [
  { id: "aud-001", timestamp: "2025-04-15 09:01:22", user: "System Administrator", action: "Login", category: "Auth", detail: "Admin signed in" },
  { id: "aud-002", timestamp: "2025-04-15 08:15:44", user: "Sophia Tan", action: "Approve Leave", category: "Leave", detail: "Approved LV-003 (Anna Villanueva — Maternity Leave)" },
  { id: "aud-003", timestamp: "2025-04-14 16:50:11", user: "Carlos Mendoza", action: "Time Out", category: "Attendance", detail: "Logged out with 2.0 OT hrs (pending approval)" },
  { id: "aud-004", timestamp: "2025-04-14 14:22:30", user: "Sophia Tan", action: "Create Job Posting", category: "Recruitment", detail: "Posted 'College Instructor — Computer Studies'" },
  { id: "aud-005", timestamp: "2025-04-13 11:08:55", user: "System Administrator", action: "Update Feature Toggle", category: "System", detail: "Enabled Recruitment module" },
  { id: "aud-006", timestamp: "2025-04-13 09:30:17", user: "Sophia Tan", action: "Schedule Interview", category: "Recruitment", detail: "Scheduled video interview for Angela Ponce" },
  { id: "aud-007", timestamp: "2025-04-12 13:45:02", user: "Maria Dela Cruz", action: "File Leave", category: "Leave", detail: "Filed Vacation Leave (2 days)" },
  { id: "aud-008", timestamp: "2025-04-12 10:12:39", user: "System Administrator", action: "Update User Role", category: "System", detail: "Activated account: Mark Fernandez" },
  { id: "aud-009", timestamp: "2025-04-11 15:33:50", user: "Sophia Tan", action: "Add Holiday", category: "System", detail: "Added 'UC South Campus Foundation Day'" },
  { id: "aud-010", timestamp: "2025-04-11 08:02:14", user: "Maria Dela Cruz", action: "Time In", category: "Attendance", detail: "Time In at 07:58" },
];

export const NOTIFICATIONS: NotificationItem[] = [
  { id: "n-001", role: "hr", title: "Pending Leave Approval", message: "Maria Dela Cruz filed a Vacation Leave (2 days) awaiting HRD approval.", timestamp: "2025-04-12 13:45", read: false, type: "leave" },
  { id: "n-002", role: "hr", title: "Overtime Approval Needed", message: "Carlos Mendoza logged 2.0 OT hrs on 2025-04-14.", timestamp: "2025-04-14 16:51", read: false, type: "overtime" },
  { id: "n-003", role: "hr", title: "New Interview Scheduled", message: "Video interview with Angela Ponce on 2025-04-22 10:00.", timestamp: "2025-04-13 09:30", read: true, type: "interview" },
  { id: "n-004", role: "employee", employeeId: "emp-001", title: "Leave Update", message: "Your Vacation Leave was approved by the Dean.", timestamp: "2025-04-12 11:20", read: false, type: "leave" },
  { id: "n-005", role: "employee", employeeId: "emp-001", title: "Upcoming Holiday", message: "Araw ng Kagitingan (Regular Holiday) on April 9.", timestamp: "2025-04-06 08:00", read: true, type: "holiday" },
  { id: "n-006", role: "employee", employeeId: "emp-001", title: "Interview Reminder", message: "Your interview with Angela Ponce is tomorrow at 10:00 AM.", timestamp: "2025-04-21 16:00", read: false, type: "interview" },
  { id: "n-007", role: "admin", title: "Geofence Updated", message: "Admin adjusted Main Building geofence radius to 120m.", timestamp: "2025-04-10 14:22", read: false, type: "system" },
  { id: "n-008", role: "hr", title: "New Applicants", message: "3 new applicants for Senior High School Teacher — STEM.", timestamp: "2025-04-12 09:15", read: true, type: "interview" },
];


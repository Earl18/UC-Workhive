"use client";

import { useWorkHive } from "@/lib/store";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { PublicHeader, PublicFooter } from "./layout";
import { HoneycombBg } from "@/components/shared/hexagon";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  Shield,
  FileText,
  Lock,
  Eye,
  Database,
  Users,
  Mail,
  Clock,
  ArrowLeft,
  ChevronRight,
  Cookie,
  Server,
  UserCheck,
  Scale,
  Building2,
  Phone,
  ArrowUp,
  Briefcase,
  IdCard,
} from "lucide-react";

const easeOut = [0.16, 1, 0.3, 1] as const;

type Section = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  shortTitle: string;
  content: { heading: string; items: string[] }[];
};

const SECTIONS: Section[] = [
  {
    id: "information-we-collect",
    icon: Database,
    title: "Information We Collect",
    shortTitle: "Information We Collect",
    content: [
      {
        heading: "Employee Profile Records",
        items: [
          "Employee ID number, full name, gender, and birth date kept in the employee master list",
          "Email address, contact number, and home address saved in the profile module",
          "Department, position, date hired, and employment status used across HR workflows",
          "Education entries such as Bachelor, Master, and Doctoral records stored in the employee profile",
        ],
      },
      {
        heading: "Applicant and Document Submissions",
        items: [
          "Applicant full name, email, contact number, and message submitted on the Careers page",
          "Position applied for and department linked to the selected job posting",
          "SSS, TIN, Pag-IBIG, and PhilHealth numbers entered during application submission",
          "Required applicant uploads collected as a requirements archive for HR review",
          "Leave attachment files uploaded by employees when supporting documents are required",
        ],
      },
      {
        heading: "Attendance, Leave, and Access Activity",
        items: [
          "Daily time-in and time-out logs, including late, undertime, overtime, and attendance remarks",
          "Leave type, leave dates, reason, approval stages, and leave balance history",
          "Login sessions, last login timestamps, and secure session cookie activity",
          "Audit log entries for important actions performed by HR staff and administrators",
          "Geofence or location verification data when GPS attendance is enabled in the system",
        ],
      },
    ],
  },
  {
    id: "how-we-use",
    icon: Eye,
    title: "How We Use Your Information",
    shortTitle: "How We Use It",
    content: [
      {
        heading: "Core HR Operations",
        items: [
          "Maintain employee master list records and self-service profile data",
          "Review job applications, uploaded requirements, interview details, and applicant progress",
          "Process attendance summaries, validation cases, overtime decisions, and exports",
          "Manage leave filing, approval routing, leave balances, and supporting attachments",
        ],
      },
      {
        heading: "Portal Access and Communication",
        items: [
          "Authenticate users and keep role-based portal sessions active",
          "Show employees, HR staff, and administrators only the modules relevant to their access level",
          "Send leave, interview, holiday, and system-generated email notifications",
          "Allow employees to view records and update the profile fields the system permits",
        ],
      },
      {
        heading: "Compliance and Service Improvement",
        items: [
          "Maintain audit trails for approvals, updates, and administrative actions",
          "Support school reporting, exports, and operational recordkeeping",
          "Enforce feature controls such as GPS attendance and account-level access rules",
          "Investigate system errors, misuse, or policy violations when needed",
        ],
      },
    ],
  },
  {
    id: "data-storage",
    icon: Server,
    title: "Data Storage & Security",
    shortTitle: "Storage & Security",
    content: [
      {
        heading: "Storage and Hosting",
        items: [
          "Employee, applicant, attendance, leave, and audit records are stored in the WorkHive database",
          "Applicant requirement archives and supported attachment files are stored in connected file storage",
          "Data is grouped by module and role so records appear only in the workflows that need them",
          "Administrative settings, user management data, and audit history are limited to authorized accounts",
        ],
      },
      {
        heading: "Security Controls",
        items: [
          "Passwords are hashed before they are stored",
          "Sign-in uses server-side verification and secure session cookies",
          "Role-based permissions separate employee, HR, and admin actions",
          "Audit logs record important create, update, delete, and approval events",
          "Uploaded files are checked against allowed file types and size limits",
          "GPS attendance can require geofence verification before attendance is accepted",
        ],
      },
    ],
  },
  {
    id: "data-sharing",
    icon: Users,
    title: "Data Sharing & Access",
    shortTitle: "Sharing & Access",
    content: [
      {
        heading: "Who Can Access Records Inside WorkHive",
        items: [
          "Employees can view their own profile, attendance, leave, application, and document-related records",
          "HR staff can review employee records, applicants, attendance reports, interviews, and leave workflows",
          "Administrators can manage users, settings, feature toggles, geofence zones, and audit history",
          "Immediate and next-level approvers can review leave requests assigned to them for approval",
        ],
      },
      {
        heading: "When Data May Be Shared or Disclosed",
        items: [
          "Applicant requirement archives and approved attachments may be stored in school-approved cloud storage connected to WorkHive",
          "Government identification numbers submitted by applicants may be used for hiring and onboarding requirements",
          "Records may be disclosed when required by law, regulation, court order, or formal school process",
          "WorkHive does not sell personal information to advertisers or unrelated third parties",
        ],
      },
    ],
  },
  {
    id: "your-rights",
    icon: UserCheck,
    title: "Your Rights",
    shortTitle: "Your Rights",
    content: [
      {
        heading: "You Have the Right To",
        items: [
          "Access your personal data stored in WorkHive",
          "Request correction of inaccurate or outdated information",
          "Request a copy of your data when applicable",
          "Object to certain processing when a valid ground exists",
          "Request deletion subject to school retention and legal requirements",
        ],
      },
      {
        heading: "How to Exercise These Rights",
        items: [
          "Contact the HR Department at hr.south@uc.edu.ph",
          "Submit a written or documented privacy request to the HR Office",
          "Provide enough detail for the school to identify the record you want reviewed",
          "Be ready to verify your identity before a request is completed",
        ],
      },
    ],
  },
  {
    id: "cookies",
    icon: Cookie,
    title: "Cookies & Session Management",
    shortTitle: "Cookies",
    content: [
      {
        heading: "Cookies Used by the Portal",
        items: [
          "A secure session cookie keeps signed-in users authenticated while using the portal",
          "User interface cookies may remember settings such as sidebar state and similar preferences",
          "These cookies support portal operation and are not used for advertising",
          "Signing out removes the active session cookie and ends the authenticated session",
        ],
      },
    ],
  },
  {
    id: "data-retention",
    icon: Clock,
    title: "Data Retention",
    shortTitle: "Data Retention",
    content: [
      {
        heading: "How Long Records Are Kept",
        items: [
          "Employee profile and employment records are kept while an account is active and according to HR recordkeeping rules",
          "Attendance logs and summaries are retained for reporting, validation, and audit review",
          "Leave records and attachments are retained with the leave history they support",
          "Applicant records and requirement archives are retained while applications are under review and under HR retention procedures",
          "Audit logs are retained for administrative and security review",
          "Session cookies remain only until sign out or session expiry",
        ],
      },
    ],
  },
  {
    id: "children",
    icon: Shield,
    title: "Children's Privacy",
    shortTitle: "Children's Privacy",
    content: [
      {
        heading: "Age Requirement",
        items: [
          "WorkHive is intended for adult employees, HR staff, administrators, and job applicants",
          "The portal is not designed to knowingly collect information from children under 18",
          "If you believe a minor's data was submitted through the system, contact HR immediately",
        ],
      },
    ],
  },
  {
    id: "changes",
    icon: FileText,
    title: "Changes to This Policy",
    shortTitle: "Policy Changes",
    content: [
      {
        heading: "Policy Updates",
        items: [
          "This Privacy Policy may be updated when WorkHive features or privacy practices change",
          "Important revisions may be announced through the portal or related school communication channels",
          "The last updated date shown on this page will reflect the latest approved revision",
          "Continued use of WorkHive after an update means the revised notice applies moving forward",
        ],
      },
    ],
  },
  {
    id: "contact",
    icon: Mail,
    title: "Contact Us",
    shortTitle: "Contact Us",
    content: [
      {
        heading: "Privacy Questions",
        items: [
          "University of Cebu - South Campus",
          "Human Resource Department",
          "Sanciangko St., Cebu City, 6000 Philippines",
          "Email: hr.south@uc.edu.ph",
          "Phone: (032) 412-1234",
          "Office hours: Monday-Friday, 8:00 AM - 5:00 PM",
        ],
      },
    ],
  },
];

const RETENTION_DATA = [
  { type: "Employee Profiles", period: "Active employment + HR retention schedule", icon: IdCard, color: "#1d4ed8" },
  { type: "Attendance Logs", period: "Reporting and audit review window", icon: Clock, color: "#0e7490" },
  { type: "Leave Records", period: "Leave history and compliance review", icon: FileText, color: "#7c3aed" },
  { type: "Audit Logs", period: "Administrative security review", icon: Shield, color: "#6b7280" },
  { type: "Applicant Files", period: "Recruitment review retention window", icon: Briefcase, color: "#ca8a04" },
  { type: "Session Cookies", period: "Until sign out or session expiry", icon: Lock, color: "#16a34a" },
];

const RIGHTS = [
  { icon: Eye, title: "Access", desc: "View the personal data WorkHive stores about you" },
  { icon: FileText, title: "Correction", desc: "Request updates to incomplete or inaccurate records" },
  { icon: Database, title: "Copy", desc: "Request a copy of data when the request is applicable" },
  { icon: Shield, title: "Object", desc: "Raise a valid objection to certain processing activities" },
  { icon: Lock, title: "Deletion", desc: "Request deletion subject to retention and legal limits" },
];

export function PrivacyPage() {
  const { setView } = useWorkHive();
  const { data } = useSystemSettings();
  const settings = data?.settings;
  const organizationName = settings?.organizationName ?? "University of Cebu - South Campus";
  const hrEmail = settings?.hrEmail ?? "hr.south@uc.edu.ph";
  const contactNumber = settings?.contactNumber ?? "(032) 412-1234";

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <HoneycombBg />

      <main className="flex-1">
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
            <div className="max-w-5xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold">
                <Shield className="h-4 w-4" />
                Privacy Policy
              </div>
              <h1 className="mt-6 max-w-5xl text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                How {organizationName} handles personal data in <span className="text-gold">WorkHive</span>
              </h1>
              <p className="mt-6 max-w-4xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                This Privacy Policy explains what WorkHive stores, why it is processed, how it is protected, and what rights users and applicants have under Philippine data privacy law.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Badge variant="outline" className="border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary">
                  <Scale className="mr-1.5 h-3.5 w-3.5" /> Republic Act No. 10173
                </Badge>
                <Badge variant="outline" className="border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary">
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> NPC privacy notice principles
                </Badge>
                <Badge variant="outline" className="border-emerald-300/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-700">
                  <Clock className="mr-1.5 h-3.5 w-3.5" /> Last updated: July 18, 2026
                </Badge>
              </div>

              <div className="mt-8">
                <Button variant="ghost" size="sm" onClick={() => setView("public:landing")} className="px-0 text-primary hover:bg-transparent hover:text-primary/80">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back to Home
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-20 space-y-1">
                <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contents
                </p>
                {SECTIONS.map((s, i) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate">{s.shortTitle}</span>
                  </a>
                ))}
                <Separator className="my-3" />
                <a href="#top" className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary">
                  <ArrowUp className="h-4 w-4" /> Back to top
                </a>
              </div>
            </aside>

            <div id="top" className="min-w-0 space-y-8">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }}>
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Scale className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-foreground">Our Commitment to Your Privacy</h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          University of Cebu - South Campus operates the WorkHive Human Resource Management System.
                          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                          when you use WorkHive. We are committed to protecting your privacy and securing your
                          personal data in compliance with the <span className="font-semibold text-foreground">Data Privacy Act of 2012 (Republic Act No. 10173)</span>.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {SECTIONS.map((section, idx) => (
                <motion.section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-20"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, ease: easeOut }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                      <section.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        Section {idx + 1}
                      </span>
                      <h2 className="text-xl font-bold leading-tight text-foreground">{section.title}</h2>
                    </div>
                  </div>

                  {section.id === "your-rights" ? (
                    <>
                      <Card className="mb-4 overflow-hidden border-border/80 shadow-sm">
                        <CardContent className="p-6">
                          <h3 className="mb-5 text-base font-semibold text-foreground">You Have the Right To</h3>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {RIGHTS.map((r) => (
                              <div
                                key={r.title}
                                className="group flex min-h-[76px] items-start gap-3 rounded-2xl border border-[#cfdcf5] bg-card px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                              >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                                  <r.icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold leading-tight text-foreground">{r.title}</p>
                                  <p className="mt-1 text-sm leading-snug text-muted-foreground">{r.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="overflow-hidden border-border/80 shadow-sm">
                        <CardContent className="p-0">
                          <div className="p-6 sm:p-7">
                            <h3 className="mb-4 flex items-center gap-3 text-base font-semibold text-foreground">
                              <span className="h-1 w-5 rounded-full bg-primary" />
                              How to Exercise These Rights
                            </h3>
                            <ul className="space-y-3">
                              <li className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                                <span>
                                  Contact the HR Department at {" "}
                                  <a href={`mailto:${hrEmail}`} className="font-medium text-primary hover:underline">{hrEmail}</a>
                                </span>
                              </li>
                              {section.content[1].items.slice(1).map((item) => (
                                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : section.id === "data-retention" ? (
                    <Card className="shadow-sm">
                      <CardContent className="p-6">
                        <div className="overflow-hidden rounded-lg border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50">
                                <th className="px-4 py-2.5 text-left font-semibold text-foreground">Data Type</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-foreground">Retention Period</th>
                              </tr>
                            </thead>
                            <tbody>
                              {RETENTION_DATA.map((r, i) => (
                                <tr key={r.type} className={i > 0 ? "border-t border-border" : ""}>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${r.color}1a`, color: r.color }}>
                                        <r.icon className="h-3.5 w-3.5" />
                                      </div>
                                      <span className="font-medium text-foreground">{r.type}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <Badge variant="outline" style={{ color: r.color, borderColor: `${r.color}40` }}>
                                      {r.period}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                          Specific retention periods may change when school policy, legal obligations, or operational requirements require a longer or shorter retention window.
                        </p>
                      </CardContent>
                    </Card>
                  ) : section.id === "contact" ? (
                    <Card className="border-primary/20 shadow-sm">
                      <CardContent className="p-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-3">
                            <div className="flex items-start gap-2.5">
                              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Office</p>
                                <p className="text-sm font-medium text-foreground">Human Resource Department</p>
                                <p className="text-xs text-muted-foreground">University of Cebu - South Campus</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Office Hours</p>
                                <p className="text-sm font-medium text-foreground">Monday - Friday 8AM - 5PM</p>
                                <p className="text-sm font-medium text-foreground">Saturday 8AM - 12PM</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-start gap-2.5">
                              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <a href={`mailto:${hrEmail}`} className="text-sm font-medium text-primary hover:underline">{hrEmail}</a>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <a href={`tel:${contactNumber.replace(/[^+\d]/g, "")}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline">{contactNumber}</a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <PolicySectionCard blocks={section.content} />
                  )}
                </motion.section>
              ))}

              <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: easeOut }}>
                <Card className="border-gold/30 bg-gradient-to-br from-gold/5 to-transparent">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                        <Lock className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-foreground">Your data is safe with us</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          WorkHive is built with privacy by design. We collect only the data needed to run employee,
                          recruitment, attendance, and leave operations, restrict access to authorized users, and do not sell personal information.
                          If you have questions about a specific record, the HR Department can help.
                        </p>
                        <Button size="sm" variant="outline" className="mt-4" onClick={() => setView("public:landing")}>
                          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Home
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function PolicySectionCard({ blocks }: { blocks: Section["content"] }) {
  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardContent className="p-0">
        {blocks.map((block, index) => (
          <div key={block.heading} className={index > 0 ? "border-t border-border/70" : ""}>
            <div className="p-6 sm:p-7">
              <h3 className="mb-4 flex items-center gap-3 text-base font-semibold text-foreground">
                <span className="h-1 w-5 rounded-full bg-primary" />
                {block.heading}
              </h3>
              <ul className="space-y-3">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}










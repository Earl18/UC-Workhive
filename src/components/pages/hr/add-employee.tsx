"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Loader2, Mail, Phone, Plus, ShieldCheck } from "lucide-react";
import { useHrMasterList } from "@/hooks/use-hr-master-list";
import { useToast } from "@/hooks/use-toast";
import { useWorkHive } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Employee, EmploymentStatus, Role, StaffCategory } from "@/lib/types";
import { calculateAgeFromBirthDate, lengthOfService } from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

type SystemSettingsResponse = {
  settings: {
    employeeDefaultPassword: string;
    hrDefaultPassword: string;
  };
};

type CreateEmployeePayload = Omit<Employee, "id"> & {
  birthDate?: string;
  accountRole: Extract<Role, "employee" | "hr">;
  createAccount: boolean;
};

type AddEmployeeDraft = Omit<Employee, "id"> & {
  birthDate?: string;
  bachelorDegree: string;
  masterDegree: string;
  doctoralDegree: string;
  accountRole: Extract<Role, "employee" | "hr">;
};

const STATUS_OPTIONS: EmploymentStatus[] = ["Regular", "Probationary", "Retired", "Resigned"];
const GENDER_OPTIONS = ["Male", "Female"] as const;
const STAFF_CATEGORY_OPTIONS: StaffCategory[] = ["Teaching", "Non-Teaching"];
const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MIN_PICKER_YEAR = 1950;
const STEP_CONFIG = [
  { id: 1, label: "Personal Information", icon: CircleUserRound, description: "Identity, educational attainment, and contact details" },
  { id: 2, label: "Employment", icon: Briefcase, description: "Department, position, date hired, and staff category" },
  { id: 3, label: "Account", icon: ShieldCheck, description: "Email account creation and final review" },
] as const;

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

async function fetchSystemSettings() {
  const response = await fetch("/api/system-settings", { cache: "no-store" });
  return readJson<SystemSettingsResponse>(response);
}

async function createEmployee(payload: CreateEmployeePayload) {
  const response = await fetch("/api/hr/master-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<{ employee: Employee & { birthDate?: string } }>(response);
}

function buildInitialDraft(): AddEmployeeDraft {
  return {
    lastName: "",
    firstName: "",
    middleName: "",
    gender: "Female",
    department: "",
    position: "",
    staffCategory: "Non-Teaching",
    dateHired: "",
    employmentStatus: "Regular",
    email: "",
    address: "",
    contactNumber: "",
    education: [],
    documents: [],
    avatarColor: undefined,
    birthDate: "",
    bachelorDegree: "",
    masterDegree: "",
    doctoralDegree: "",
    accountRole: "employee",
  };
}

function buildEducation(draft: AddEmployeeDraft) {
  const education: Employee["education"] = [];

  if (draft.bachelorDegree.trim()) {
    education.push({
      level: "Bachelor",
      degree: draft.bachelorDegree.trim(),
      school: "University of Cebu - South Campus",
    });
  }

  if (draft.masterDegree.trim()) {
    education.push({
      level: "Master",
      degree: draft.masterDegree.trim(),
      school: "University of Cebu - South Campus",
    });
  }

  if (draft.doctoralDegree.trim()) {
    education.push({
      level: "Doctoral",
      degree: draft.doctoralDegree.trim(),
      school: "University of Cebu - South Campus",
    });
  }

  return education;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AddEmployeePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setSelectedEmployeeId, setView } = useWorkHive();
  const { data } = useHrMasterList();
  const departments = data?.departments ?? [];
  const positions = data?.positions ?? [];
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<AddEmployeeDraft>(buildInitialDraft);
  const [defaultPasswords, setDefaultPasswords] = useState({ employee: "Employee@123", hr: "HR@123" });

  useEffect(() => {
    let active = true;
    void fetchSystemSettings()
      .then((payload) => {
        if (!active) {
          return;
        }
        setDefaultPasswords({
          employee: payload.settings.employeeDefaultPassword || "Employee@123",
          hr: payload.settings.hrDefaultPassword || "HR@123",
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const derivedAge = calculateAgeFromBirthDate(draft.birthDate);
  const derivedService = draft.dateHired ? lengthOfService(draft.dateHired) : "-";
  const selectedDefaultPassword = draft.accountRole === "hr" ? defaultPasswords.hr : defaultPasswords.employee;

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: ({ employee }) => {
      queryClient.setQueryData(["hr-master-list", employee.id], { employee });
      void queryClient.invalidateQueries({ queryKey: ["hr-master-list"] });
      toast({
        title: "Employee Added",
        description: `${employee.lastName}, ${employee.firstName} was added to the employee master list and the website account was created.`,
      });
      setSelectedEmployeeId(employee.id);
      setView("hr:employee-details");
    },
    onError: (error) => {
      toast({
        title: "Unable to add employee",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const canContinue = useMemo(() => {
    if (step === 1) {
      return Boolean(
        draft.lastName.trim() &&
        draft.firstName.trim() &&
        draft.gender &&
        draft.birthDate &&
        draft.email.trim() &&
        isValidEmail(draft.email) &&
        draft.contactNumber.trim() &&
        draft.address.trim(),
      );
    }

    if (step === 2) {
      return Boolean(draft.department.trim() && draft.position.trim() && draft.dateHired && draft.staffCategory && draft.employmentStatus);
    }

    return Boolean(draft.accountRole && draft.email.trim() && isValidEmail(draft.email));
  }, [draft, step]);

  function patchDraft(patch: Partial<AddEmployeeDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function submit() {
    createMutation.mutate({
      ...draft,
      education: buildEducation(draft),
      documents: [],
      birthDate: draft.birthDate?.trim() || undefined,
      email: draft.email.trim(),
      address: draft.address.trim(),
      contactNumber: draft.contactNumber.trim(),
      department: draft.department.trim(),
      position: draft.position.trim(),
      lastName: draft.lastName.trim(),
      firstName: draft.firstName.trim(),
      middleName: draft.middleName.trim(),
      createAccount: true,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={() => setView("hr:master-list")} className="mb-2 px-0 text-primary hover:bg-transparent">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Master List
        </Button>
        <h1 className="text-2xl font-bold text-primary">Add Employee</h1>
        <p className="text-sm text-muted-foreground">Create a new employee record and website account using the UC WorkHive flow.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {STEP_CONFIG.map((item) => {
          const Icon = item.icon;
          const active = step === item.id;
          const completed = step > item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : completed ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${active ? "bg-primary-foreground/15" : completed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-primary">{STEP_CONFIG[step - 1]?.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Last Name" value={draft.lastName} onChange={(value) => patchDraft({ lastName: value })} required />
                <Field label="First Name" value={draft.firstName} onChange={(value) => patchDraft({ firstName: value })} required />
                <Field label="Middle Name" value={draft.middleName} onChange={(value) => patchDraft({ middleName: value })} />
                <SelectField label="Gender" value={draft.gender} onValueChange={(value) => patchDraft({ gender: value as Employee["gender"] })} options={GENDER_OPTIONS.map((value) => ({ value, label: value }))} required />
                <DateField label="Birth Date" value={draft.birthDate} onChange={(value) => patchDraft({ birthDate: value })} required />
                <Field label="Age" value={derivedAge?.toString() ?? ""} onChange={() => undefined} disabled />
                <TextareaField label="Address" value={draft.address} onChange={(value) => patchDraft({ address: value })} required />
                <Field
                  label="Email Address"
                  value={draft.email}
                  onChange={(value) => patchDraft({ email: value })}
                  type="email"
                  placeholder="name@gmail.com or name@uc.edu.ph"
                  icon={<Mail className="h-4 w-4" />}
                  required
                />
                <Field label="Contact Number" value={draft.contactNumber} onChange={(value) => patchDraft({ contactNumber: value })} icon={<Phone className="h-4 w-4" />} required />
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <EducationField label="Bachelor" value={draft.bachelorDegree} onChange={(value) => patchDraft({ bachelorDegree: value })} />
                <EducationField label="Master" value={draft.masterDegree} onChange={(value) => patchDraft({ masterDegree: value })} />
                <EducationField label="Doctoral" value={draft.doctoralDegree} onChange={(value) => patchDraft({ doctoralDegree: value })} />
              </div>
              {!isValidEmail(draft.email) && draft.email.trim() ? <p className="text-xs text-destructive">Use a valid email address for account creation.</p> : null}
              {isValidEmail(draft.email) ? <p className="text-xs text-muted-foreground">University email is recommended when available, but Gmail and other valid email addresses are accepted.</p> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SelectField label="Department" value={draft.department} onValueChange={(value) => patchDraft({ department: value })} options={departments.map((value) => ({ value, label: value }))} allowCustom required />
                <SelectField label="Position" value={draft.position} onValueChange={(value) => patchDraft({ position: value })} options={positions.map((value) => ({ value, label: value }))} allowCustom required />
                <DateField label="Date Hired" value={draft.dateHired} onChange={(value) => patchDraft({ dateHired: value })} required />
                <Field label="Length of Service" value={derivedService} onChange={() => undefined} disabled />
                <SelectField label="Staff Category" value={draft.staffCategory ?? "Non-Teaching"} onValueChange={(value) => patchDraft({ staffCategory: value as StaffCategory })} options={STAFF_CATEGORY_OPTIONS.map((value) => ({ value, label: value }))} required />
                <SelectField label="E-Status" value={draft.employmentStatus} onValueChange={(value) => patchDraft({ employmentStatus: value as EmploymentStatus })} options={STATUS_OPTIONS.map((value) => ({ value, label: value }))} required />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Email Address" value={draft.email} onChange={() => undefined} icon={<Mail className="h-4 w-4" />} disabled />
                <Field label="Default Password" value={selectedDefaultPassword} onChange={() => undefined} disabled />
                <SelectField label="Account Type" value={draft.accountRole} onValueChange={(value) => patchDraft({ accountRole: value as Extract<Role, "employee" | "hr"> })} options={[{ value: "employee", label: "Employee" }, { value: "hr", label: "HR" }]} required />
              </div>

            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => step === 1 ? setView("hr:master-list") : setStep((current) => current - 1)} disabled={createMutation.isPending}>
              <ArrowLeft className="mr-2 h-4 w-4" /> {step === 1 ? "Cancel" : "Previous"}
            </Button>
            <div className="flex gap-2">
              {step < STEP_CONFIG.length ? (
                <Button
                  onClick={() => {
                    if (!canContinue) {
                      return;
                    }
                    setStep((current) => current + 1);
                  }}
                  disabled={!canContinue || createMutation.isPending}
                >
                  Continue
                </Button>
              ) : (
                <Button onClick={() => { if (canContinue) { submit(); } }} disabled={!canContinue || createMutation.isPending} className="bg-primary">
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add Employee
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  required = false,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</Label>
      <div className="relative">
        {icon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span> : null}
        <Input
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          pattern={type === "email" ? "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" : undefined}
          title={type === "email" ? "Use a valid email address." : undefined}
          className={icon ? "pl-10" : undefined}
        />
      </div>
    </div>
  );
}

function TextareaField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder={`Enter ${label.toLowerCase()}`} className="min-h-[40px] resize-none" />
    </div>
  );
}

function DateField({ label, value, onChange, required = false }: { label: string; value?: string; onChange: (value: string) => void; required?: boolean }) {
  const parsedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const isValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
  const [displayMonth, setDisplayMonth] = useState<Date>(isValidDate ? parsedDate : new Date());
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - MIN_PICKER_YEAR + 1 }, (_, index) => currentYear - index);
  }, []);

  const activeMonthLabel = MONTH_OPTIONS[displayMonth.getMonth()];
  const activeYear = displayMonth.getFullYear();

  function moveMonth(direction: -1 | 1) {
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function selectMonth(monthIndex: number) {
    setDisplayMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setMonthOpen(false);
  }

  function selectYear(year: number) {
    setDisplayMonth((current) => new Date(year, current.getMonth(), 1));
    setYearOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background",
              !isValidDate && "text-muted-foreground",
            )}
          >
            <span>{isValidDate ? format(parsedDate, "MMMM d, yyyy") : `Select ${label.toLowerCase()}`}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-auto overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start">
          <div className="border-b border-border/60 px-3 pb-3 pt-4">
            <div className="relative flex items-center justify-center px-8">
              <Button type="button" variant="ghost" size="icon" className="absolute left-0 size-8 rounded-lg" onClick={() => moveMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center gap-2.5">
                <Popover open={monthOpen} onOpenChange={setMonthOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[6.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium">
                      <span>{activeMonthLabel}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid gap-1">
                        {MONTH_OPTIONS.map((monthName, index) => (
                          <Button
                            key={monthName}
                            type="button"
                            variant={index === displayMonth.getMonth() ? "secondary" : "ghost"}
                            className="h-9 justify-start rounded-md px-3"
                            onClick={() => selectMonth(index)}
                          >
                            {monthName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover open={yearOpen} onOpenChange={setYearOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[5.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium">
                      <span>{activeYear}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-72 w-28 overflow-y-auto p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="grid gap-1">
                      {years.map((year) => (
                        <Button
                          key={year}
                          type="button"
                          variant={year === activeYear ? "secondary" : "ghost"}
                          className="h-9 justify-start rounded-md px-3"
                          onClick={() => selectYear(year)}
                        >
                          {year}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 size-8 rounded-lg" onClick={() => moveMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Calendar
            mode="single"
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            selected={isValidDate ? parsedDate : undefined}
            onSelect={(selectedDate) => {
              if (!selectedDate) {
                return;
              }
              setDisplayMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
              onChange(format(selectedDate, "yyyy-MM-dd"));
            }}
            disabled={(date) => date > new Date()}
            hideNavigation
            className="flex justify-center px-4 pb-4 pt-4"
            classNames={{
              root: "mx-auto w-fit",
              months: "w-fit",
              month: "w-fit gap-3",
              month_caption: "hidden",
              table: "w-full table-fixed border-collapse",
              weekdays: "grid grid-cols-7",
              week: "grid grid-cols-7 mt-2",
              weekday: "text-center text-[0.8rem] font-normal text-muted-foreground",
              day: "relative p-0 text-center",
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
function EducationField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-primary">Educational Attainment: {label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} placeholder={`Enter ${label.toLowerCase()} degree`} />
      </CardContent>
    </Card>
  );
}

function SelectField({ label, value, onValueChange, options, allowCustom = false, required = false }: { label: string; value: string; onValueChange: (value: string) => void; options: Array<{ value: string; label: string }>; allowCustom?: boolean; required?: boolean }) {
  const normalizedOptions = options.filter((option, index, array) => option.value && array.findIndex((entry) => entry.value === option.value) === index);
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = normalizedOptions.filter((option) => {
    if (!normalizedValue) {
      return true;
    }

    return option.label.toLowerCase().includes(normalizedValue) || option.value.toLowerCase().includes(normalizedValue);
  });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</Label>
      {allowCustom ? (
        <div className="relative">
          <Input
            value={value}
            onChange={(event) => {
              onValueChange(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              setTimeout(() => setIsOpen(false), 120);
            }}
            placeholder={`Enter ${label.toLowerCase()}`}
            autoComplete="off"
          />
          {isOpen && filteredOptions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              <ScrollArea className="max-h-56">
                <div className="p-1">
                  {filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onValueChange(option.value);
                        setIsOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>
      ) : (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {normalizedOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}





















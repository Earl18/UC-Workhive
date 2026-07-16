import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSystemSettings } from "@/lib/admin-data";
import { getEmployeeMasterListForExport, type EmployeeMasterListPageFilters } from "@/lib/hr-data";
import { exportEmployeeMasterListWorkbook } from "@/lib/hr-export";


function parseSupportedDate(value?: string | null) {
  const text = (value ?? "").trim();
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, month, day, rawYear] = slashMatch;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    const parsed = new Date(year, Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForExport(value?: string | null) {
  const parsed = parseSupportedDate(value);
  if (!parsed) {
    return (value ?? "").trim() || "-";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calculateAgeFromBirthDateForExport(birthDate?: string | null) {
  const parsed = parseSupportedDate(birthDate);
  if (!parsed) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  const dayDiff = today.getDate() - parsed.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function lengthOfServiceForExport(dateHired?: string | null) {
  const hired = parseSupportedDate(dateHired);
  if (!hired) {
    return "-";
  }

  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(hired.getFullYear(), hired.getMonth(), hired.getDate());

  if (start > current) {
    return "0 yrs 0 mo 0 days";
  }

  let years = current.getFullYear() - start.getFullYear();
  let months = current.getMonth() - start.getMonth();
  let days = current.getDate() - start.getDate();

  if (days < 0) {
    const previousMonth = new Date(current.getFullYear(), current.getMonth(), 0);
    days += previousMonth.getDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return `${years} yr${years !== 1 ? "s" : ""} ${months} mo ${days} day${days !== 1 ? "s" : ""}`;
}

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      classification?: string;
      filters?: EmployeeMasterListPageFilters;
    };

    const sourceEmployees = await getEmployeeMasterListForExport(body.filters ?? {});
    const employees = sourceEmployees.map((employee, index) => ({
      idNumber: employee.idNumber?.trim() || "",
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName,
      gender: employee.gender,
      department: employee.department,
      position: employee.position,
      dateHired: employee.dateHired,
      dateHiredDisplay: formatDateForExport(employee.dateHired),
      lengthOfService: lengthOfServiceForExport(employee.dateHired),
      age: calculateAgeFromBirthDateForExport(employee.birthDate) ?? null,
      employmentStatus: employee.employmentStatus,
      email: employee.email,
      address: employee.address,
      contactNumber: employee.contactNumber,
      birthDate: employee.birthDate ?? "",
      education: employee.education,
    }));

    if (employees.length === 0) {
      return NextResponse.json({ error: "No employee records matched the current filters for export." }, { status: 400 });
    }

    const settings = await getSystemSettings();
    const workbook = await exportEmployeeMasterListWorkbook({
      organizationName: settings.organizationName,
      campusAddress: settings.campusAddress,
      reportTitle: "Monitoring Report of Employment Status",
      classification: body.classification?.trim() || "Administrative / Non-Teaching",
      employees,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="employee-master-list-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export employee master list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

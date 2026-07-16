import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getHrTardinessMonitoring } from "@/lib/attendance-data";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const payload = await getHrTardinessMonitoring({
      month: searchParams.get("month") ?? undefined,
      period: searchParams.get("period") ?? undefined,
      staffCategory: searchParams.get("staffCategory") === "Teaching" ? "Teaching" : "Non-Teaching",
      department: searchParams.get("department") ?? undefined,
      employmentStatus: searchParams.get("employmentStatus") ?? undefined,
      sortKey: (searchParams.get("sortKey") as "timesLate" | "totalLateMinutes" | "avgLateMinutes" | null) ?? undefined,
      sortDir: (searchParams.get("sortDir") as "asc" | "desc" | null) ?? undefined,
    });

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load tardiness monitoring." },
      { status: 400 },
    );
  }
}

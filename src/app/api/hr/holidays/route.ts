import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { createHolidayRecord, deleteHolidayRecord, getHolidayRecords, updateHolidayRecord } from "@/lib/holiday-data";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const holidays = await getHolidayRecords();
  return NextResponse.json({ holidays }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as { name?: string; date?: string; type?: string };
    const holiday = await createHolidayRecord(body);
    return NextResponse.json({ holiday }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add holiday." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as { id?: string; name?: string; date?: string; type?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Holiday id is required." }, { status: 400 });
    }
    const holiday = await updateHolidayRecord(body.id, body);
    return NextResponse.json({ holiday });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update holiday." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Holiday id is required." }, { status: 400 });
  }

  try {
    await deleteHolidayRecord(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete holiday." },
      { status: 400 },
    );
  }
}

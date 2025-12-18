import { NextResponse } from "next/server";
import { getAvailabilityForDate } from "@/lib/availability";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing date (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const slots = await getAvailabilityForDate(date);
    return NextResponse.json({ date, slots });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Failed" }, { status: 500 });
  }
}

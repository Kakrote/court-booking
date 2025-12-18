import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function time(hhmm: string) {
  return new Date(`1970-01-01T${hhmm}:00`);
}

export async function POST(req: Request) {
  const body = await req.json();
  const coachId = String(body.coachId ?? "");
  const windows: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }> =
    Array.isArray(body.windows) ? body.windows : [];

  if (!coachId) return NextResponse.json({ error: "coachId required" }, { status: 400 });

  // Replace availability for coach.
  await prisma.coachAvailability.deleteMany({ where: { coachId } });

  const data = windows.map((w) => ({
    coachId,
    dayOfWeek: Number(w.dayOfWeek),
    startTime: time(String(w.startTime)),
    endTime: time(String(w.endTime)),
    isActive: w.isActive !== false,
  }));

  await prisma.coachAvailability.createMany({ data });
  return NextResponse.json({ ok: true });
}

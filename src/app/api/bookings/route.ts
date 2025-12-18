import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBooking } from "@/lib/booking";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const bookings = await prisma.booking.findMany({
    where: { customerEmail: email.trim().toLowerCase() },
    orderBy: { startAt: "desc" },
    include: {
      court: { include: { court: true } },
      coach: { include: { coach: true } },
      equipment: { include: { equipmentType: true } },
    },
  });

  return NextResponse.json({ bookings });
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const result = await createBooking(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const code =
      typeof (e as { code?: unknown })?.code === "string" ? ((e as { code: string }).code as string) : undefined;
    if (code === "RESOURCE_UNAVAILABLE") {
      return NextResponse.json({ error: (e as Error).message, code }, { status: 409 });
    }

    return NextResponse.json({ error: (e as Error).message ?? "Failed" }, { status: 400 });
  }
}

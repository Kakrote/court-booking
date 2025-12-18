import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET() {
  const coaches = await prisma.coach.findMany({
    orderBy: { name: "asc" },
    include: { availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  });
  return NextResponse.json({ coaches });
}

export async function POST(req: Request) {
  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const hourlyRateCents = Number(body.hourlyRateCents ?? 0);
  const isActive = body.isActive !== false;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!Number.isFinite(hourlyRateCents) || hourlyRateCents < 0) return NextResponse.json({ error: "hourlyRateCents invalid" }, { status: 400 });

  const coach = await prisma.coach.create({
    data: { name, hourlyRateCents: Math.round(hourlyRateCents), isActive },
  });

  return NextResponse.json({ coach }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Prisma.CoachUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.hourlyRateCents !== undefined) data.hourlyRateCents = Math.round(Number(body.hourlyRateCents));
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const coach = await prisma.coach.update({ where: { id }, data });
  return NextResponse.json({ coach });
}

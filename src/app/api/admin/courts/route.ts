import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET() {
  const courts = await prisma.court.findMany({ orderBy: [{ surface: "asc" }, { name: "asc" }] });
  return NextResponse.json({ courts });
}

export async function POST(req: Request) {
  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const surface = body.surface;
  const baseRateCentsPerHour = Number(body.baseRateCentsPerHour ?? 0);
  const isActive = body.isActive !== false;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (surface !== "INDOOR" && surface !== "OUTDOOR") return NextResponse.json({ error: "surface invalid" }, { status: 400 });
  if (!Number.isFinite(baseRateCentsPerHour) || baseRateCentsPerHour < 0) {
    return NextResponse.json({ error: "baseRateCentsPerHour invalid" }, { status: 400 });
  }

  const court = await prisma.court.create({
    data: { name, surface, baseRateCentsPerHour: Math.round(baseRateCentsPerHour), isActive },
  });

  return NextResponse.json({ court }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Prisma.CourtUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.surface !== undefined) data.surface = body.surface;
  if (body.baseRateCentsPerHour !== undefined) data.baseRateCentsPerHour = Math.round(Number(body.baseRateCentsPerHour));
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const court = await prisma.court.update({ where: { id }, data });
  return NextResponse.json({ court });
}

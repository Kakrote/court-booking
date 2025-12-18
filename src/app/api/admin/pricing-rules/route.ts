import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CourtSurface, DayType, Prisma, PricingAppliesTo } from "@prisma/client";

function time(hhmm: string) {
  return new Date(`1970-01-01T${hhmm}:00`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const pricingRules = await prisma.pricingRule.findMany({
    orderBy: [{ appliesTo: "asc" }, { priority: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ pricingRules });
}

export async function POST(req: Request) {
  const body = await req.json();

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const rule = await prisma.pricingRule.create({
    data: {
      name,
      isActive: body.isActive !== false,
      priority: Number(body.priority ?? 100),
      appliesTo: body.appliesTo,
      dayType: body.dayType ?? "ANY",
      startTime: body.startTime ? time(String(body.startTime)) : null,
      endTime: body.endTime ? time(String(body.endTime)) : null,
      courtSurface: body.courtSurface ?? null,
      equipmentTypeId: body.equipmentTypeId ?? null,
      coachId: body.coachId ?? null,
      multiplierBps: Number(body.multiplierBps ?? 10000),
      addCents: Number(body.addCents ?? 0),
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}

export async function PATCH(req: Request) {
  const raw: unknown = await req.json();
  if (!isRecord(raw)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const id = String(raw.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Prisma.PricingRuleUncheckedUpdateInput = {};

  if (raw.name !== undefined) data.name = String(raw.name ?? "").trim();
  if (raw.isActive !== undefined) data.isActive = Boolean(raw.isActive);
  if (raw.priority !== undefined) data.priority = Number(raw.priority);
  if (raw.appliesTo !== undefined) data.appliesTo = String(raw.appliesTo) as PricingAppliesTo;
  if (raw.dayType !== undefined) data.dayType = String(raw.dayType) as DayType;
  if (raw.courtSurface !== undefined) {
    data.courtSurface = raw.courtSurface ? (String(raw.courtSurface) as CourtSurface) : null;
  }
  if (raw.equipmentTypeId !== undefined) data.equipmentTypeId = raw.equipmentTypeId ? String(raw.equipmentTypeId) : null;
  if (raw.coachId !== undefined) data.coachId = raw.coachId ? String(raw.coachId) : null;
  if (raw.multiplierBps !== undefined) data.multiplierBps = Number(raw.multiplierBps);
  if (raw.addCents !== undefined) data.addCents = Number(raw.addCents);

  if (raw.startTime !== undefined) data.startTime = raw.startTime ? time(String(raw.startTime)) : null;
  if (raw.endTime !== undefined) data.endTime = raw.endTime ? time(String(raw.endTime)) : null;

  const rule = await prisma.pricingRule.update({ where: { id }, data });
  return NextResponse.json({ rule });
}

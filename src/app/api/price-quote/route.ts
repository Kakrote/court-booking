import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quotePrice } from "@/lib/pricing";

type QuoteBody = {
  startAt: string;
  endAt: string;
  courtId: string;
  coachId?: string | null;
  equipment?: Array<{ equipmentTypeId: string; quantity: number }>;
};

export async function POST(req: Request) {
  const body = (await req.json()) as QuoteBody;

  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return NextResponse.json({ error: "Invalid startAt/endAt" }, { status: 400 });
  }

  const equipmentRequested = (body.equipment ?? [])
    .map((e) => ({ equipmentTypeId: e.equipmentTypeId, quantity: Math.max(0, Math.floor(e.quantity)) }))
    .filter((e) => e.quantity > 0);

  const [court, coach, pricingRules, equipmentTypes] = await Promise.all([
    prisma.court.findFirst({ where: { id: body.courtId, isActive: true } }),
    body.coachId ? prisma.coach.findFirst({ where: { id: body.coachId, isActive: true } }) : Promise.resolve(null),
    prisma.pricingRule.findMany({ where: { isActive: true } }),
    equipmentRequested.length
      ? prisma.equipmentType.findMany({ where: { isActive: true, id: { in: equipmentRequested.map((e) => e.equipmentTypeId) } } })
      : Promise.resolve([]),
  ]);

  if (!court) return NextResponse.json({ error: "Court not found or inactive" }, { status: 404 });
  if (body.coachId && !coach) return NextResponse.json({ error: "Coach not found or inactive" }, { status: 404 });

  const equipmentTypesById = new Map(equipmentTypes.map((e) => [e.id, e] as const));
  for (const e of equipmentRequested) {
    if (!equipmentTypesById.has(e.equipmentTypeId)) {
      return NextResponse.json({ error: "Equipment type not found or inactive" }, { status: 404 });
    }
  }

  const priceBreakdown = quotePrice({
    startAt,
    endAt,
    court,
    coach,
    equipment: equipmentRequested.map((e) => ({ equipmentType: equipmentTypesById.get(e.equipmentTypeId)!, quantity: e.quantity })),
    pricingRules,
  });

  return NextResponse.json({ priceBreakdown });
}

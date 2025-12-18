import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET() {
  const equipmentTypes = await prisma.equipmentType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ equipmentTypes });
}

export async function POST(req: Request) {
  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const unitPriceCents = Number(body.unitPriceCents ?? 0);
  const totalQuantity = Number(body.totalQuantity ?? 0);
  const isActive = body.isActive !== false;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) return NextResponse.json({ error: "unitPriceCents invalid" }, { status: 400 });
  if (!Number.isFinite(totalQuantity) || totalQuantity < 0) return NextResponse.json({ error: "totalQuantity invalid" }, { status: 400 });

  const equipmentType = await prisma.equipmentType.create({
    data: {
      name,
      unitPriceCents: Math.round(unitPriceCents),
      totalQuantity: Math.round(totalQuantity),
      isActive,
    },
  });

  return NextResponse.json({ equipmentType }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Prisma.EquipmentTypeUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.unitPriceCents !== undefined) data.unitPriceCents = Math.round(Number(body.unitPriceCents));
  if (body.totalQuantity !== undefined) data.totalQuantity = Math.round(Number(body.totalQuantity));
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const equipmentType = await prisma.equipmentType.update({ where: { id }, data });
  return NextResponse.json({ equipmentType });
}

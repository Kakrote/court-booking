import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [config, courts, equipmentTypes, coaches] = await Promise.all([
    prisma.facilityConfig.findUnique({ where: { id: "default" } }),
    prisma.court.findMany({ orderBy: [{ surface: "asc" }, { name: "asc" }] }),
    prisma.equipmentType.findMany({ orderBy: { name: "asc" } }),
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ config, courts, equipmentTypes, coaches });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { joinWaitlist } from "@/lib/waitlist";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const entries = await prisma.waitlistEntry.findMany({
    where: { customerEmail: email.trim().toLowerCase() },
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const result = await joinWaitlist(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Failed" }, { status: 400 });
  }
}

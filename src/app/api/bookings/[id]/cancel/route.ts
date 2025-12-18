import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/booking";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    const result = await cancelBooking(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Failed" }, { status: 400 });
  }
}

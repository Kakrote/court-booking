import { NextResponse } from "next/server";
import { listNotifications } from "@/lib/waitlist";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const notifications = await listNotifications(email);
  return NextResponse.json({ notifications });
}

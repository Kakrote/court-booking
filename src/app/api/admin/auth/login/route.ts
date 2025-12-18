import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { getAdminSessionCookieName, signAdminSession } from "@/lib/adminAuth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: Request) {
  const raw: unknown = await req.json().catch(() => ({}));
  if (!isRecord(raw)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const email = String(raw.email ?? "").trim().toLowerCase();
  const password = String(raw.password ?? "");
  const next = typeof raw.next === "string" ? raw.next : "/admin";

  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !admin.isActive) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const ok = await compare(password, admin.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const token = await signAdminSession({ sub: admin.id, email: admin.email, name: admin.name });

  const res = NextResponse.json({ ok: true, next });
  res.cookies.set({
    name: getAdminSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return res;
}

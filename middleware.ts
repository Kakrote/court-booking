import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionCookieName, verifyAdminSession } from "@/lib/adminAuth";

function wantsJson(req: NextRequest) {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

function unauthorizedApi() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Allow login endpoints and page.
  if (path.startsWith("/admin/login") || path.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // Fail closed if secret is missing.
  if (!process.env.ADMIN_JWT_SECRET) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("error", "server_misconfigured");
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get(getAdminSessionCookieName())?.value;
  const session = token ? await verifyAdminSession(token) : null;

  if (!session) {
    if (path.startsWith("/api/admin")) return unauthorizedApi();
    if (wantsJson(req)) return unauthorizedApi();

    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

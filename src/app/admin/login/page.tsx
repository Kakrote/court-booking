"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

function getSearchParam(name: string) {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = useMemo(() => getSearchParam("next") ?? "/admin", []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Login failed";
        throw new Error(msg);
      }

      // Redirect client-side.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg font-semibold">Admin login</div>
            <div className="text-xs text-zinc-600">Sign in to access the admin panel</div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-zinc-700 hover:text-zinc-900" href="/">
              New booking
            </Link>
            <Link className="text-zinc-700 hover:text-zinc-900" href="/history">
              Booking history
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        <form onSubmit={onSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-zinc-700">Email</div>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-700">Password</div>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error ? <div className="text-sm text-red-700">{error}</div> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-300"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <div className="text-xs text-zinc-600">
              You can change the seeded admin credentials in your `.env` and re-run `npm run db:seed`.
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

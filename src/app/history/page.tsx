"use client";

import { useState } from "react";
import Link from "next/link";

type BookingItem = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  priceTotalCents: number;
  court?: { court?: { name: string } } | null;
  coach?: { coach?: { name: string } } | null;
  equipment?: Array<{ equipmentType: { name: string }; quantity: number }>;
};

type WaitlistItem = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  position: number;
  preferredSurface: string | null;
  wantsCoach: boolean;
};

type NotificationItem = {
  id: string;
  type: string;
  createdAt: string;
  payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [bRaw, wRaw, nRaw] = await Promise.all([
        fetch(`/api/bookings?email=${encodeURIComponent(email)}`, { cache: "no-store" }).then((r) =>
          r.json().catch(() => ({}))
        ),
        fetch(`/api/waitlist?email=${encodeURIComponent(email)}`, { cache: "no-store" }).then((r) =>
          r.json().catch(() => ({}))
        ),
        fetch(`/api/notifications?email=${encodeURIComponent(email)}`, { cache: "no-store" }).then((r) =>
          r.json().catch(() => ({}))
        ),
      ]);

      if (isRecord(bRaw) && typeof bRaw.error === "string") throw new Error(bRaw.error);
      if (isRecord(wRaw) && typeof wRaw.error === "string") throw new Error(wRaw.error);
      if (isRecord(nRaw) && typeof nRaw.error === "string") throw new Error(nRaw.error);

      setBookings(isRecord(bRaw) && Array.isArray(bRaw.bookings) ? (bRaw.bookings as BookingItem[]) : []);
      setWaitlist(isRecord(wRaw) && Array.isArray(wRaw.entries) ? (wRaw.entries as WaitlistItem[]) : []);
      setNotifications(
        isRecord(nRaw) && Array.isArray(nRaw.notifications) ? (nRaw.notifications as NotificationItem[]) : []
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = isRecord(data) && typeof data.error === "string" ? data.error : "Cancel failed";
        throw new Error(msg);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg font-semibold">Booking history</div>
            <div className="text-xs text-zinc-600">View bookings, waitlist, and notifications</div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-zinc-700 hover:text-zinc-900" href="/">
              New booking
            </Link>
            <Link className="text-zinc-700 hover:text-zinc-900" href="/admin/login?next=/admin">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-zinc-700">Email</div>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex items-end">
              <button
                disabled={!email.trim() || loading}
                onClick={load}
                className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-300"
              >
                {loading ? "Loading…" : "Load"}
              </button>
            </div>
          </div>
          {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium">Bookings</div>
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-md border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">
                    {fmtDateTime(b.startAt)} — {fmtDateTime(b.endAt)}
                  </div>
                  <div className={b.status === "CANCELLED" ? "text-xs text-zinc-500" : "text-xs text-emerald-700"}>
                    {b.status}
                  </div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Court: {b.court?.court?.name ?? "—"}
                  {b.coach?.coach?.name ? ` • Coach: ${b.coach.coach.name}` : ""}
                  {b.equipment?.length
                    ? ` • Equipment: ${b.equipment.map((e) => `${e.equipmentType.name}×${e.quantity}`).join(", ")}`
                    : ""}
                </div>
                <div className="mt-1 text-xs text-zinc-600">Total: ₹{(b.priceTotalCents / 100).toFixed(2)}</div>
                {b.status === "CONFIRMED" ? (
                  <div className="mt-3">
                    <button
                      onClick={() => cancelBooking(b.id)}
                      disabled={loading}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 disabled:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {!bookings.length ? <div className="text-sm text-zinc-600">No bookings found.</div> : null}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium">Waitlist</div>
          <div className="space-y-2">
            {waitlist.map((w) => (
              <div key={w.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {fmtDateTime(w.startAt)} — {fmtDateTime(w.endAt)}
                  </div>
                  <div className="text-xs text-zinc-600">{w.status}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Position: {w.position}
                  {w.preferredSurface ? ` • Surface: ${w.preferredSurface}` : ""}
                  {w.wantsCoach ? " • Wants coach" : ""}
                </div>
              </div>
            ))}
            {!waitlist.length ? <div className="text-sm text-zinc-600">No waitlist entries.</div> : null}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium">Notifications</div>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{n.type}</div>
                  <div className="text-xs text-zinc-600">{fmtDateTime(n.createdAt)}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600">{JSON.stringify(n.payload)}</div>
              </div>
            ))}
            {!notifications.length ? <div className="text-sm text-zinc-600">No notifications.</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}

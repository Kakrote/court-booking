"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PriceBreakdownView } from "@/components/PriceBreakdown";
import type { PriceBreakdown } from "@/lib/pricing";

type CourtSurface = "INDOOR" | "OUTDOOR";

type Court = { id: string; name: string; surface: CourtSurface; isActive: boolean; baseRateCentsPerHour: number };
type Coach = { id: string; name: string; isActive: boolean; hourlyRateCents: number };
type EquipmentType = { id: string; name: string; isActive: boolean; unitPriceCents: number; totalQuantity: number };

type SlotAvailability = {
  startAt: string;
  endAt: string;
  availableCourts: Court[];
  availableCoaches: Coach[];
  equipmentRemaining: Array<{ equipmentType: EquipmentType; remaining: number; reserved: number }>;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);
  const [courtId, setCourtId] = useState<string>("");
  const [coachId, setCoachId] = useState<string>("");
  const [equipmentQty, setEquipmentQty] = useState<Record<string, number>>({});

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [quote, setQuote] = useState<PriceBreakdown | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [suggestWaitlist, setSuggestWaitlist] = useState(false);

  const selectedSlot = useMemo(() => {
    if (!selectedSlotStart) return null;
    return slots.find((s) => s.startAt === selectedSlotStart) ?? null;
  }, [slots, selectedSlotStart]);

  const selectedCourt = useMemo(() => {
    return selectedSlot?.availableCourts.find((c) => c.id === courtId) ?? null;
  }, [selectedSlot, courtId]);

  function resetSelectionAndQuote() {
    setSelectedSlotStart(null);
    setCourtId("");
    setCoachId("");
    setEquipmentQty({});
    setQuote(null);
    setQuoteError(null);
    setBookingError(null);
    setBookingSuccess(null);
    setSuggestWaitlist(false);
  }

  function handleDateChange(nextDate: string) {
    setDate(nextDate);
    setLoadingSlots(true);
    resetSelectionAndQuote();
  }

  function handleSelectSlot(slot: SlotAvailability) {
    setSelectedSlotStart(slot.startAt);
    setCourtId(slot.availableCourts[0]?.id ?? "");
    setCoachId("");
    setEquipmentQty({});
    setQuote(null);
    setQuoteError(null);
    setBookingError(null);
    setBookingSuccess(null);
    setSuggestWaitlist(false);
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/availability?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  // Live pricing.
  useEffect(() => {
    if (!selectedSlot) return;
    if (!courtId) return;

    const handle = setTimeout(() => {
      setQuoteError(null);
      fetch(`/api/price-quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
          courtId,
          coachId: coachId || null,
          equipment: Object.entries(equipmentQty)
            .map(([equipmentTypeId, quantity]) => ({ equipmentTypeId, quantity }))
            .filter((e) => e.quantity > 0),
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setQuote(null);
            setQuoteError(String(data.error));
            return;
          }
          setQuote(data.priceBreakdown ?? null);
        })
        .catch(() => {
          setQuote(null);
          setQuoteError("Failed to calculate price");
        });
    }, 250);

    return () => clearTimeout(handle);
  }, [selectedSlot, courtId, coachId, equipmentQty]);

  async function confirmBooking() {
    if (!selectedSlot || !courtId) return;
    setIsBooking(true);
    setBookingError(null);
    setBookingSuccess(null);
    setSuggestWaitlist(false);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerEmail,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        courtId,
        coachId: coachId || null,
        equipment: Object.entries(equipmentQty)
          .map(([equipmentTypeId, quantity]) => ({ equipmentTypeId, quantity }))
          .filter((e) => e.quantity > 0),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setBookingError(String(data.error ?? "Booking failed"));
      setSuggestWaitlist(res.status === 409);
      setIsBooking(false);
      return;
    }

    setBookingSuccess(`Booking confirmed: ${data.bookingId}`);
    setIsBooking(false);
  }

  async function joinWaitlist() {
    if (!selectedSlot) return;
    setBookingError(null);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerEmail,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        preferredSurface: selectedCourt?.surface ?? null,
        wantsCoach: Boolean(coachId),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBookingError(String(data.error ?? "Failed to join waitlist"));
      return;
    }
    setBookingSuccess(`Joined waitlist (position ${data.position})`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg font-semibold">Court Booking</div>
            <div className="text-xs text-zinc-600">Book a court with optional equipment and coach</div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-zinc-700 hover:text-zinc-900" href="/history">
              Booking history
            </Link>
            <Link className="text-zinc-700 hover:text-zinc-900" href="/admin/login?next=/admin">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-2">
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Date</div>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>
              <div className="text-sm text-zinc-600">{loadingSlots ? "Loading slots…" : `${slots.length} slots`}</div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 text-sm font-medium">Available slots</div>
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {slots.map((s) => {
                const label = `${fmtTime(s.startAt)}–${fmtTime(s.endAt)}`;
                const disabled = s.availableCourts.length === 0;
                const selected = selectedSlotStart === s.startAt;
                return (
                  <button
                    key={s.startAt}
                    disabled={disabled}
                    onClick={() => handleSelectSlot(s)}
                    className={
                      "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors " +
                      (disabled
                        ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                        : selected
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 hover:bg-zinc-50")
                    }
                  >
                    <span className="font-medium">{label}</span>
                    <span className={selected ? "text-white/80" : "text-zinc-600"}>
                      Courts: {s.availableCourts.length} • Coaches: {s.availableCoaches.length}
                    </span>
                  </button>
                );
              })}

              {!slots.length && !loadingSlots ? (
                <div className="text-sm text-zinc-600">No slots available for this date.</div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 text-sm font-medium">Selection</div>

            {!selectedSlot ? (
              <div className="text-sm text-zinc-600">Pick a slot to continue.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-zinc-700">Court</div>
                    <select
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={courtId}
                      onChange={(e) => setCourtId(e.target.value)}
                    >
                      {selectedSlot.availableCourts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-zinc-700">Coach (optional)</div>
                    <select
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={coachId}
                      onChange={(e) => setCoachId(e.target.value)}
                    >
                      <option value="">No coach</option>
                      {selectedSlot.availableCoaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-700">Equipment (optional)</div>
                  <div className="mt-2 space-y-2">
                    {selectedSlot.equipmentRemaining.map((e) => {
                      const qty = equipmentQty[e.equipmentType.id] ?? 0;
                      const max = e.remaining;
                      return (
                        <div key={e.equipmentType.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium">{e.equipmentType.name}</div>
                            <div className="text-xs text-zinc-600">Remaining: {max}</div>
                          </div>
                          <input
                            className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                            type="number"
                            min={0}
                            max={max}
                            value={qty}
                            onChange={(ev) => {
                              const next = Math.max(0, Math.min(max, Number(ev.target.value)));
                              setEquipmentQty((prev) => ({ ...prev, [e.equipmentType.id]: next }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-zinc-700">Your name</div>
                    <input
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Anshu"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-zinc-700">Email</div>
                    <input
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {quoteError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{quoteError}</div> : null}
          {quote ? <PriceBreakdownView breakdown={quote} /> : null}

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <button
              disabled={!selectedSlot || !courtId || !customerName.trim() || !customerEmail.trim() || isBooking}
              onClick={confirmBooking}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isBooking ? "Booking…" : "Confirm booking"}
            </button>

            {bookingError ? <div className="mt-3 text-sm text-red-700">{bookingError}</div> : null}
            {bookingSuccess ? <div className="mt-3 text-sm text-emerald-700">{bookingSuccess}</div> : null}

            {suggestWaitlist ? (
              <div className="mt-3">
                <button
                  onClick={joinWaitlist}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  Join waitlist for this slot
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

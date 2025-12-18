"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CourtSurface = "INDOOR" | "OUTDOOR";

type Court = { id: string; name: string; surface: CourtSurface; baseRateCentsPerHour: number; isActive: boolean };

type EquipmentType = { id: string; name: string; unitPriceCents: number; totalQuantity: number; isActive: boolean };

type CoachAvailability = { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean };

type Coach = {
  id: string;
  name: string;
  hourlyRateCents: number;
  isActive: boolean;
  availability: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>;
};

type PricingRule = {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  appliesTo: "COURT" | "COACH" | "EQUIPMENT";
  dayType: "ANY" | "WEEKDAY" | "WEEKEND";
  startTime: string | null;
  endTime: string | null;
  courtSurface: CourtSurface | null;
  equipmentTypeId: string | null;
  coachId: string | null;
  multiplierBps: number;
  addCents: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toHHMM(timeIso: string | null): string {
  if (!timeIso) return "";
  const d = new Date(timeIso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courts, setCourts] = useState<Court[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  const [availabilityDraft, setAvailabilityDraft] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [cRaw, eRaw, coRaw, prRaw] = await Promise.all([
        fetch("/api/admin/courts", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/equipment-types", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/coaches", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/pricing-rules", { cache: "no-store" }).then((r) => r.json()),
      ]);

      if (isRecord(cRaw) && typeof cRaw.error === "string") throw new Error(cRaw.error);
      if (isRecord(eRaw) && typeof eRaw.error === "string") throw new Error(eRaw.error);
      if (isRecord(coRaw) && typeof coRaw.error === "string") throw new Error(coRaw.error);
      if (isRecord(prRaw) && typeof prRaw.error === "string") throw new Error(prRaw.error);

      const loadedCourts = isRecord(cRaw) && Array.isArray(cRaw.courts) ? (cRaw.courts as Court[]) : [];
      const loadedEquipmentTypes =
        isRecord(eRaw) && Array.isArray(eRaw.equipmentTypes) ? (eRaw.equipmentTypes as EquipmentType[]) : [];
      const loadedCoaches = isRecord(coRaw) && Array.isArray(coRaw.coaches) ? (coRaw.coaches as Coach[]) : [];
      const loadedPricingRules =
        isRecord(prRaw) && Array.isArray(prRaw.pricingRules) ? (prRaw.pricingRules as PricingRule[]) : [];

      setCourts(loadedCourts);
      setEquipmentTypes(loadedEquipmentTypes);
      setCoaches(loadedCoaches);
      setPricingRules(
        loadedPricingRules.map((r) => ({
          ...r,
          startTime: r.startTime ? toHHMM(r.startTime) : null,
          endTime: r.endTime ? toHHMM(r.endTime) : null,
        })),
      );

      const drafts: Record<string, string> = {};
      for (const coach of loadedCoaches) {
        drafts[coach.id] = JSON.stringify(
          (coach.availability ?? []).map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: toHHMM(a.startTime),
            endTime: toHHMM(a.endTime),
            isActive: a.isActive,
          })),
          null,
          2,
        );
      }
      setAvailabilityDraft(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function patch(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = isRecord(data) && typeof data.error === "string" ? data.error : "Update failed";
      throw new Error(msg);
    }
  }

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = isRecord(data) && typeof data.error === "string" ? data.error : "Create failed";
      throw new Error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg font-semibold">Admin</div>
            <div className="text-xs text-zinc-600">Manage courts, equipment, coaches, and pricing rules</div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-zinc-700 hover:text-zinc-900" href="/">
              New booking
            </Link>
            <Link className="text-zinc-700 hover:text-zinc-900" href="/history">
              Booking history
            </Link>
            <button
              className="text-zinc-700 hover:text-zinc-900"
              onClick={async () => {
                try {
                  await fetch("/api/admin/auth/logout", { method: "POST" });
                } finally {
                  window.location.href = "/admin/login";
                }
              }}
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <button
            onClick={loadAll}
            disabled={loading}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:bg-zinc-100"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium">Courts</div>
          <div className="space-y-2">
            {courts.map((c) => (
              <div key={c.id} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 p-3 md:grid-cols-5">
                <input
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm md:col-span-2"
                  value={c.name}
                  onChange={(e) => setCourts((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                />
                <select
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  value={c.surface}
                  onChange={(e) => setCourts((prev) => prev.map((x) => (x.id === c.id ? { ...x, surface: e.target.value as CourtSurface } : x)))}
                >
                  <option value="INDOOR">INDOOR</option>
                  <option value="OUTDOOR">OUTDOOR</option>
                </select>
                <input
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  type="number"
                  value={c.baseRateCentsPerHour}
                  onChange={(e) => setCourts((prev) => prev.map((x) => (x.id === c.id ? { ...x, baseRateCentsPerHour: Number(e.target.value) } : x)))}
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      onChange={(e) => setCourts((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: e.target.checked } : x)))}
                    />
                    Active
                  </label>
                  <button
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                    onClick={async () => {
                      setError(null);
                      try {
                        await patch("/api/admin/courts", c);
                        await loadAll();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              onClick={async () => {
                setError(null);
                try {
                  await post("/api/admin/courts", { name: "New Court", surface: "INDOOR", baseRateCentsPerHour: 600, isActive: true });
                  await loadAll();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Add court
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium">Equipment inventory</div>
          <div className="space-y-2">
            {equipmentTypes.map((et) => (
              <div key={et.id} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 p-3 md:grid-cols-6">
                <input
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm md:col-span-2"
                  value={et.name}
                  onChange={(e) => setEquipmentTypes((prev) => prev.map((x) => (x.id === et.id ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  type="number"
                  value={et.unitPriceCents}
                  onChange={(e) => setEquipmentTypes((prev) => prev.map((x) => (x.id === et.id ? { ...x, unitPriceCents: Number(e.target.value) } : x)))}
                />
                <input
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  type="number"
                  value={et.totalQuantity}
                  onChange={(e) => setEquipmentTypes((prev) => prev.map((x) => (x.id === et.id ? { ...x, totalQuantity: Number(e.target.value) } : x)))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={et.isActive}
                    onChange={(e) => setEquipmentTypes((prev) => prev.map((x) => (x.id === et.id ? { ...x, isActive: e.target.checked } : x)))}
                  />
                  Active
                </label>
                <button
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                  onClick={async () => {
                    setError(null);
                    try {
                      await patch("/api/admin/equipment-types", et);
                      await loadAll();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Save
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              onClick={async () => {
                setError(null);
                try {
                  await post("/api/admin/equipment-types", { name: "New Equipment", unitPriceCents: 100, totalQuantity: 1, isActive: true });
                  await loadAll();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Add equipment type
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium">Coaches</div>
          <div className="space-y-2">
            {coaches.map((c) => (
              <div key={c.id} className="rounded-md border border-zinc-200 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm md:col-span-2"
                    value={c.name}
                    onChange={(e) => setCoaches((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    type="number"
                    value={c.hourlyRateCents}
                    onChange={(e) => setCoaches((prev) => prev.map((x) => (x.id === c.id ? { ...x, hourlyRateCents: Number(e.target.value) } : x)))}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      onChange={(e) => setCoaches((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: e.target.checked } : x)))}
                    />
                    Active
                  </label>
                  <button
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                    onClick={async () => {
                      setError(null);
                      try {
                        await patch("/api/admin/coaches", { id: c.id, name: c.name, hourlyRateCents: c.hourlyRateCents, isActive: c.isActive });
                        await loadAll();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Save
                  </button>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-medium text-zinc-700">Availability JSON</div>
                  <textarea
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
                    rows={6}
                    value={availabilityDraft[c.id] ?? "[]"}
                    onChange={(e) => setAvailabilityDraft((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                      onClick={async () => {
                        setError(null);
                        try {
                          const parsed = JSON.parse(availabilityDraft[c.id] ?? "[]") as CoachAvailability[];
                          await post("/api/admin/coach-availability", { coachId: c.id, windows: parsed });
                          await loadAll();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Save availability
                    </button>
                    <div className="text-xs text-zinc-600 self-center">
                      Format: <code className="font-mono">{'[{"dayOfWeek":0..6,"startTime":"HH:MM","endTime":"HH:MM","isActive":true}]'}</code>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              onClick={async () => {
                setError(null);
                try {
                  await post("/api/admin/coaches", { name: "New Coach", hourlyRateCents: 600, isActive: true });
                  await loadAll();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Add coach
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium">Pricing rules</div>
          <div className="space-y-2">
            {pricingRules.map((r) => (
              <div key={r.id} className="rounded-md border border-zinc-200 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm md:col-span-2"
                    value={r.name}
                    onChange={(e) => setPricingRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                  />
                  <select
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    value={r.appliesTo}
                    onChange={(e) =>
                      setPricingRules((prev) =>
                        prev.map((x) => (x.id === r.id ? { ...x, appliesTo: e.target.value as PricingRule["appliesTo"] } : x)),
                      )
                    }
                  >
                    <option value="COURT">COURT</option>
                    <option value="COACH">COACH</option>
                    <option value="EQUIPMENT">EQUIPMENT</option>
                  </select>
                  <select
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    value={r.dayType}
                    onChange={(e) =>
                      setPricingRules((prev) =>
                        prev.map((x) => (x.id === r.id ? { ...x, dayType: e.target.value as PricingRule["dayType"] } : x)),
                      )
                    }
                  >
                    <option value="ANY">ANY</option>
                    <option value="WEEKDAY">WEEKDAY</option>
                    <option value="WEEKEND">WEEKEND</option>
                  </select>
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    type="number"
                    value={r.multiplierBps}
                    onChange={(e) => setPricingRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, multiplierBps: Number(e.target.value) } : x)))}
                    title="Multiplier in basis points (10000 = 1.00x)"
                  />
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    type="number"
                    value={r.addCents}
                    onChange={(e) => setPricingRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, addCents: Number(e.target.value) } : x)))}
                    title="Flat add in cents"
                  />
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-6">
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    type="number"
                    value={r.priority}
                    onChange={(e) => setPricingRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, priority: Number(e.target.value) } : x)))}
                    title="Lower runs first"
                  />
                  <select
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    value={r.courtSurface ?? ""}
                    onChange={(e) =>
                      setPricingRules((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, courtSurface: (e.target.value || null) as CourtSurface | null } : x,
                        ),
                      )
                    }
                    title="Optional: filter by court surface"
                  >
                    <option value="">Any surface</option>
                    <option value="INDOOR">INDOOR</option>
                    <option value="OUTDOOR">OUTDOOR</option>
                  </select>
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    type="time"
                    value={r.startTime ?? ""}
                    onChange={(e) =>
                      setPricingRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, startTime: e.target.value || null } : x)))
                    }
                    title="Optional start time"
                  />
                  <input
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    type="time"
                    value={r.endTime ?? ""}
                    onChange={(e) =>
                      setPricingRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, endTime: e.target.value || null } : x)))
                    }
                    title="Optional end time"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      onChange={(e) => setPricingRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: e.target.checked } : x)))}
                    />
                    Active
                  </label>
                  <button
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                    onClick={async () => {
                      setError(null);
                      try {
                        await patch("/api/admin/pricing-rules", {
                          ...r,
                        });
                        await loadAll();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              onClick={async () => {
                setError(null);
                try {
                  await post("/api/admin/pricing-rules", {
                    name: "New rule",
                    appliesTo: "COURT",
                    dayType: "ANY",
                    multiplierBps: 10000,
                    addCents: 0,
                    priority: 100,
                    isActive: true,
                  });
                  await loadAll();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Add pricing rule
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

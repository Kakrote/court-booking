import type { PriceBreakdown } from "@/lib/pricing";

function formatMoney(cents: number) {
  // Treat cents as the smallest currency unit (e.g., paise).
  const value = (cents / 100).toFixed(2);
  return `₹${value}`;
}

export function PriceBreakdownView({ breakdown }: { breakdown: PriceBreakdown }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-900">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Price</div>
        <div className="text-base font-semibold">{formatMoney(breakdown.totalCents)}</div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <div className="font-medium">Court</div>
            <div>{formatMoney(breakdown.court.totalCents)}</div>
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            Base: {formatMoney(breakdown.court.baseCents)}
            {breakdown.court.appliedRules.length ? (
              <ul className="mt-1 list-disc pl-5">
                {breakdown.court.appliedRules.map((r) => (
                  <li key={r.id}>{r.name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="font-medium">Equipment</div>
            <div>{formatMoney(breakdown.equipment.totalCents)}</div>
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            {breakdown.equipment.items.length ? (
              <ul className="list-disc pl-5">
                {breakdown.equipment.items.map((i) => (
                  <li key={i.equipmentTypeId}>
                    {i.name} × {i.quantity} — {formatMoney(i.lineTotalCents)}
                  </li>
                ))}
              </ul>
            ) : (
              <div>None</div>
            )}
            {breakdown.equipment.appliedRules.length ? (
              <ul className="mt-1 list-disc pl-5">
                {breakdown.equipment.appliedRules.map((r) => (
                  <li key={r.id}>{r.name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="font-medium">Coach</div>
            <div>{formatMoney(breakdown.coach.totalCents)}</div>
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            {breakdown.coach.baseCents ? (
              <div>Base: {formatMoney(breakdown.coach.baseCents)}</div>
            ) : (
              <div>None</div>
            )}
            {breakdown.coach.appliedRules.length ? (
              <ul className="mt-1 list-disc pl-5">
                {breakdown.coach.appliedRules.map((r) => (
                  <li key={r.id}>{r.name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

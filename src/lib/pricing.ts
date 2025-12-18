import {
  type Coach,
  type Court,
  type EquipmentType,
  type PricingRule,
  DayType,
  PricingAppliesTo,
} from "@prisma/client";

import { isWeekend, overlapsTimeWindow, timeFieldToMinutes } from "./time";

export type EquipmentSelection = {
  equipmentType: EquipmentType;
  quantity: number;
};

export type PricingQuoteInput = {
  startAt: Date;
  endAt: Date;
  court: Court;
  equipment: EquipmentSelection[];
  coach?: Coach | null;
  pricingRules: PricingRule[];
};

export type AppliedRule = {
  id: string;
  name: string;
  appliesTo: PricingAppliesTo;
  multiplierBps: number;
  addCents: number;
};

export type PriceBreakdown = {
  durationMinutes: number;
  court: {
    courtId: string;
    baseRateCentsPerHour: number;
    baseCents: number;
    appliedRules: AppliedRule[];
    totalCents: number;
  };
  equipment: {
    items: Array<{ equipmentTypeId: string; name: string; unitPriceCents: number; quantity: number; lineTotalCents: number }>;
    appliedRules: AppliedRule[];
    subtotalCents: number;
    totalCents: number;
  };
  coach: {
    coachId?: string;
    hourlyRateCents?: number;
    baseCents: number;
    appliedRules: AppliedRule[];
    totalCents: number;
  };
  totalCents: number;
};

function minutesBetween(startAt: Date, endAt: Date): number {
  const ms = endAt.getTime() - startAt.getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function matchesDayType(rule: PricingRule, startAt: Date): boolean {
  if (rule.dayType === DayType.ANY) return true;
  const weekend = isWeekend(startAt);
  return rule.dayType === DayType.WEEKEND ? weekend : !weekend;
}

function matchesTimeWindow(rule: PricingRule, startAt: Date, endAt: Date): boolean {
  if (!rule.startTime || !rule.endTime) return true;
  const startMin = timeFieldToMinutes(rule.startTime);
  const endMin = timeFieldToMinutes(rule.endTime);
  return overlapsTimeWindow(startAt, endAt, startMin, endMin);
}

function applyRuleSet(baseCents: number, rules: PricingRule[]): { totalCents: number; applied: AppliedRule[] } {
  let total = baseCents;
  const applied: AppliedRule[] = [];

  for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
    if (rule.multiplierBps !== 10000) {
      total = Math.round((total * rule.multiplierBps) / 10000);
    }
    if (rule.addCents !== 0) {
      total += rule.addCents;
    }

    applied.push({
      id: rule.id,
      name: rule.name,
      appliesTo: rule.appliesTo,
      multiplierBps: rule.multiplierBps,
      addCents: rule.addCents,
    });
  }

  return { totalCents: Math.max(0, total), applied };
}

export function quotePrice(input: PricingQuoteInput): PriceBreakdown {
  const durationMinutes = minutesBetween(input.startAt, input.endAt);
  const hours = durationMinutes / 60;

  const courtBaseCents = Math.round(input.court.baseRateCentsPerHour * hours);

  const courtRules = input.pricingRules.filter(
    (r) =>
      r.isActive &&
      r.appliesTo === PricingAppliesTo.COURT &&
      matchesDayType(r, input.startAt) &&
      matchesTimeWindow(r, input.startAt, input.endAt) &&
      (!r.courtSurface || r.courtSurface === input.court.surface),
  );

  const equipmentItems = input.equipment
    .filter((e) => e.quantity > 0)
    .map((e) => ({
      equipmentTypeId: e.equipmentType.id,
      name: e.equipmentType.name,
      unitPriceCents: e.equipmentType.unitPriceCents,
      quantity: e.quantity,
      lineTotalCents: e.quantity * e.equipmentType.unitPriceCents,
    }));

  const equipmentSubtotalCents = equipmentItems.reduce((sum, i) => sum + i.lineTotalCents, 0);

  const equipmentRules = input.pricingRules.filter(
    (r) =>
      r.isActive &&
      r.appliesTo === PricingAppliesTo.EQUIPMENT &&
      matchesDayType(r, input.startAt) &&
      matchesTimeWindow(r, input.startAt, input.endAt),
  );

  const coachBaseCents = input.coach ? Math.round(input.coach.hourlyRateCents * hours) : 0;

  const coachRules = input.pricingRules.filter(
    (r) =>
      r.isActive &&
      r.appliesTo === PricingAppliesTo.COACH &&
      matchesDayType(r, input.startAt) &&
      matchesTimeWindow(r, input.startAt, input.endAt) &&
      (!r.coachId || r.coachId === input.coach?.id),
  );

  const courtApplied = applyRuleSet(courtBaseCents, courtRules);
  const equipmentApplied = applyRuleSet(equipmentSubtotalCents, equipmentRules);
  const coachApplied = applyRuleSet(coachBaseCents, coachRules);

  const totalCents = courtApplied.totalCents + equipmentApplied.totalCents + coachApplied.totalCents;

  return {
    durationMinutes,
    court: {
      courtId: input.court.id,
      baseRateCentsPerHour: input.court.baseRateCentsPerHour,
      baseCents: courtBaseCents,
      appliedRules: courtApplied.applied,
      totalCents: courtApplied.totalCents,
    },
    equipment: {
      items: equipmentItems,
      appliedRules: equipmentApplied.applied,
      subtotalCents: equipmentSubtotalCents,
      totalCents: equipmentApplied.totalCents,
    },
    coach: {
      coachId: input.coach?.id,
      hourlyRateCents: input.coach?.hourlyRateCents,
      baseCents: coachBaseCents,
      appliedRules: coachApplied.applied,
      totalCents: coachApplied.totalCents,
    },
    totalCents,
  };
}

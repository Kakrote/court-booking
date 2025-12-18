import { prisma } from "./prisma";
import { addMinutes, minutesOfDay, parseLocalDate, timeFieldToMinutes } from "./time";
import type { Court, EquipmentType, Coach, CoachAvailability } from "@prisma/client";

export type SlotAvailability = {
  startAt: string;
  endAt: string;
  availableCourts: Court[];
  availableCoaches: Coach[];
  equipmentRemaining: Array<{ equipmentType: EquipmentType; remaining: number; reserved: number }>;
};

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function coachIsAvailableForSlot(
  coachId: string,
  slotStart: Date,
  slotEnd: Date,
  availabilityByCoach: Map<string, CoachAvailability[]>,
): boolean {
  const windows = availabilityByCoach.get(coachId) ?? [];
  const slotStartMin = minutesOfDay(slotStart);
  const slotEndMin = minutesOfDay(slotEnd);

  return windows.some((w) => {
    const startMin = timeFieldToMinutes(w.startTime);
    const endMin = timeFieldToMinutes(w.endTime);
    return slotStartMin >= startMin && slotEndMin <= endMin;
  });
}

export async function getAvailabilityForDate(dateISO: string): Promise<SlotAvailability[]> {
  const config = await prisma.facilityConfig.findUnique({ where: { id: "default" } });
  if (!config) throw new Error("FacilityConfig missing. Run seed.");

  const dayStart = parseLocalDate(dateISO);
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const openMin = timeFieldToMinutes(config.openTime);
  const closeMin = timeFieldToMinutes(config.closeTime);

  const [courts, equipmentTypes, coaches, coachAvail, courtBookings, coachBookings, equipmentBookings] =
    await Promise.all([
      prisma.court.findMany({ where: { isActive: true }, orderBy: [{ surface: "asc" }, { name: "asc" }] }),
      prisma.equipmentType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.coach.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.coachAvailability.findMany({ where: { isActive: true, dayOfWeek: dayStart.getDay() } }),
      prisma.bookingCourt.findMany({
        where: {
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { courtId: true, startAt: true, endAt: true },
      }),
      prisma.bookingCoach.findMany({
        where: {
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { coachId: true, startAt: true, endAt: true },
      }),
      prisma.bookingEquipment.findMany({
        where: {
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { equipmentTypeId: true, quantity: true, startAt: true, endAt: true },
      }),
    ]);

  const availabilityByCoach = new Map<string, CoachAvailability[]>();
  for (const a of coachAvail) {
    const list = availabilityByCoach.get(a.coachId) ?? [];
    list.push(a);
    availabilityByCoach.set(a.coachId, list);
  }

  const slots: SlotAvailability[] = [];
  for (let startMin = openMin; startMin + config.slotMinutes <= closeMin; startMin += config.slotMinutes) {
    const slotStart = addMinutes(dayStart, startMin);
    const slotEnd = addMinutes(slotStart, config.slotMinutes);

    const availableCourts = courts.filter((court) => {
      const booked = courtBookings.some((b) => b.courtId === court.id && rangesOverlap(b.startAt, b.endAt, slotStart, slotEnd));
      return !booked;
    });

    const availableCoaches = coaches.filter((coach) => {
      if (!coachIsAvailableForSlot(coach.id, slotStart, slotEnd, availabilityByCoach)) return false;
      const booked = coachBookings.some((b) => b.coachId === coach.id && rangesOverlap(b.startAt, b.endAt, slotStart, slotEnd));
      return !booked;
    });

    const equipmentRemaining = equipmentTypes.map((et) => {
      const reserved = equipmentBookings
        .filter((b) => b.equipmentTypeId === et.id && rangesOverlap(b.startAt, b.endAt, slotStart, slotEnd))
        .reduce((sum, b) => sum + b.quantity, 0);

      return {
        equipmentType: et,
        reserved,
        remaining: Math.max(0, et.totalQuantity - reserved),
      };
    });

    slots.push({
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
      availableCourts,
      availableCoaches,
      equipmentRemaining,
    });
  }

  return slots;
}

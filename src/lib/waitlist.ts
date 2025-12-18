import type { CourtSurface, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { minutesOfDay, timeFieldToMinutes } from "./time";

export type JoinWaitlistInput = {
  customerName: string;
  customerEmail: string;
  startAt: string;
  endAt: string;
  preferredSurface?: CourtSurface | null;
  wantsCoach?: boolean;
};

export function buildQueueKey(params: {
  startAt: Date;
  endAt: Date;
  preferredSurface?: CourtSurface | null;
  wantsCoach: boolean;
}): string {
  const surfaceKey = params.preferredSurface ?? "ANY";
  return `${params.startAt.toISOString()}|${params.endAt.toISOString()}|${surfaceKey}|${params.wantsCoach ? "COACH" : "NOCOACH"}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function hasAnyCoachAvailable(
  tx: Prisma.TransactionClient,
  args: { startAt: Date; endAt: Date },
): Promise<boolean> {
  const dayOfWeek = args.startAt.getDay();

  const [coaches, availability, booked] = await Promise.all([
    tx.coach.findMany({ where: { isActive: true }, select: { id: true } }),
    tx.coachAvailability.findMany({ where: { isActive: true, dayOfWeek }, select: { coachId: true, startTime: true, endTime: true } }),
    tx.bookingCoach.findMany({
      where: {
        startAt: { lt: args.endAt },
        endAt: { gt: args.startAt },
      },
      select: { coachId: true },
    }),
  ]);

  const bookedSet = new Set(booked.map((b) => b.coachId));

  const availabilityByCoach = new Map<string, Array<{ startTime: Date; endTime: Date }>>();
  for (const a of availability) {
    const list = availabilityByCoach.get(a.coachId) ?? [];
    list.push({ startTime: a.startTime, endTime: a.endTime });
    availabilityByCoach.set(a.coachId, list);
  }

  const slotStartMin = minutesOfDay(args.startAt);
  const slotEndMin = minutesOfDay(args.endAt);

  for (const coach of coaches) {
    if (bookedSet.has(coach.id)) continue;
    const windows = availabilityByCoach.get(coach.id) ?? [];
    const ok = windows.some((w) => {
      const startMin = timeFieldToMinutes(w.startTime);
      const endMin = timeFieldToMinutes(w.endTime);
      return slotStartMin >= startMin && slotEndMin <= endMin;
    });
    if (ok) return true;
  }

  return false;
}

export async function joinWaitlist(input: JoinWaitlistInput) {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) throw new Error("Invalid startAt/endAt");
  if (endAt <= startAt) throw new Error("endAt must be after startAt");

  const customerName = input.customerName.trim();
  const customerEmail = normalizeEmail(input.customerEmail);
  if (!customerName) throw new Error("customerName required");
  if (!customerEmail) throw new Error("customerEmail required");

  const wantsCoach = Boolean(input.wantsCoach);
  const preferredSurface = input.preferredSurface ?? null;

  return prisma.$transaction(async (tx) => {
    const queueKey = buildQueueKey({ startAt, endAt, preferredSurface, wantsCoach });

    const last = await tx.waitlistEntry.findFirst({
      where: { queueKey, status: "QUEUED" },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = (last?.position ?? 0) + 1;

    const entry = await tx.waitlistEntry.create({
      data: {
        customerName,
        customerEmail,
        startAt,
        endAt,
        preferredSurface,
        wantsCoach,
        queueKey,
        status: "QUEUED",
        position,
      },
      select: { id: true, position: true },
    });

    return { waitlistEntryId: entry.id, position: entry.position };
  });
}

export async function notifyNextWaitlistForSlot(
  tx: Prisma.TransactionClient,
  args: { startAt: Date; endAt: Date; surface: CourtSurface },
) {
  const coachPossible = await hasAnyCoachAvailable(tx, { startAt: args.startAt, endAt: args.endAt });

  // Prefer surface-specific entries, then "ANY" surface.
  const candidates = await tx.waitlistEntry.findMany({
    where: {
      status: "QUEUED",
      startAt: args.startAt,
      endAt: args.endAt,
      OR: [{ preferredSurface: args.surface }, { preferredSurface: null }],
      wantsCoach: coachPossible ? undefined : false,
    },
    orderBy: [{ createdAt: "asc" }, { position: "asc" }],
    take: 1,
  });

  const next = candidates[0];
  if (!next) return;

  await tx.waitlistEntry.update({
    where: { id: next.id },
    data: { status: "NOTIFIED", notifiedAt: new Date() },
  });

  await tx.notification.create({
    data: {
      email: next.customerEmail,
      type: "WAITLIST_AVAILABLE",
      payload: {
        waitlistEntryId: next.id,
        startAt: args.startAt.toISOString(),
        endAt: args.endAt.toISOString(),
        preferredSurface: next.preferredSurface,
        wantsCoach: next.wantsCoach,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function listNotifications(email: string) {
  const normalized = normalizeEmail(email);
  return prisma.notification.findMany({
    where: { email: normalized },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

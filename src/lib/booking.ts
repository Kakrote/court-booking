import { prisma } from "./prisma";
import { quotePrice } from "./pricing";
import type { PriceBreakdown } from "./pricing";
import { Prisma } from "@prisma/client";
import { notifyNextWaitlistForSlot } from "./waitlist";

class EquipmentUnavailableError extends Error {
  readonly code = "EQUIPMENT_UNAVAILABLE" as const;
}

class ResourceUnavailableError extends Error {
  readonly code = "RESOURCE_UNAVAILABLE" as const;
}

export type CreateBookingInput = {
  customerName: string;
  customerEmail: string;
  startAt: string;
  endAt: string;
  courtId: string;
  coachId?: string | null;
  equipment?: Array<{ equipmentTypeId: string; quantity: number }>;
};

export type BookingCreateResult = {
  bookingId: string;
  priceTotalCents: number;
  priceBreakdown: PriceBreakdown;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isOverlapConstraintError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as { message?: unknown }).message ?? "");
  return (
    msg.includes("BookingCourt_no_overlap") ||
    msg.includes("BookingCoach_no_overlap") ||
    msg.includes("23P01")
  );
}

async function lockAndCheckEquipment(
  tx: Prisma.TransactionClient,
  equipmentTypeId: string,
  requestedQty: number,
  startAt: Date,
  endAt: Date,
) {
  const rows = await tx.$queryRaw<Array<{ id: string; totalQuantity: number }>>(
    Prisma.sql`
      SELECT "id", "totalQuantity"
      FROM "EquipmentType"
      WHERE "id" = ${equipmentTypeId}
      FOR UPDATE
    `,
  );

  const locked = rows[0];
  if (!locked) throw new Error("Equipment type not found");

  const reservedRows = await tx.$queryRaw<Array<{ reserved: number }>>(
    Prisma.sql`
      SELECT COALESCE(SUM("quantity"), 0)::int AS reserved
      FROM "BookingEquipment"
      WHERE "equipmentTypeId" = ${equipmentTypeId}
        AND "startAt" < ${endAt}
        AND "endAt" > ${startAt}
    `,
  );

  const reserved = reservedRows[0]?.reserved ?? 0;
  if (reserved + requestedQty > locked.totalQuantity) {
    const remaining = Math.max(0, locked.totalQuantity - reserved);
    throw new EquipmentUnavailableError(`Not enough inventory. Remaining: ${remaining}`);
  }
}

export async function createBooking(input: CreateBookingInput): Promise<BookingCreateResult> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) throw new Error("Invalid startAt");
  if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) throw new Error("Invalid endAt");
  if (endAt <= startAt) throw new Error("endAt must be after startAt");

  const customerName = input.customerName.trim();
  const customerEmail = normalizeEmail(input.customerEmail);
  if (!customerName) throw new Error("customerName required");
  if (!customerEmail) throw new Error("customerEmail required");

  const equipmentRequested = (input.equipment ?? [])
    .map((e) => ({ equipmentTypeId: e.equipmentTypeId, quantity: Math.max(0, Math.floor(e.quantity)) }))
    .filter((e) => e.quantity > 0);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const [court, coach, pricingRules, equipmentTypes] = await Promise.all([
          tx.court.findFirst({ where: { id: input.courtId, isActive: true } }),
          input.coachId ? tx.coach.findFirst({ where: { id: input.coachId, isActive: true } }) : Promise.resolve(null),
          tx.pricingRule.findMany({ where: { isActive: true } }),
          equipmentRequested.length
            ? tx.equipmentType.findMany({ where: { isActive: true, id: { in: equipmentRequested.map((e) => e.equipmentTypeId) } } })
            : Promise.resolve([]),
        ]);

        if (!court) throw new Error("Court not found or inactive");
        if (input.coachId && !coach) throw new Error("Coach not found or inactive");

        // Equipment checks with deterministic locking order to reduce deadlocks.
        const equipmentTypesById = new Map(equipmentTypes.map((e) => [e.id, e] as const));
        const sortedEquipment = [...equipmentRequested].sort((a, b) => a.equipmentTypeId.localeCompare(b.equipmentTypeId));

        for (const e of sortedEquipment) {
          const et = equipmentTypesById.get(e.equipmentTypeId);
          if (!et) throw new Error("Equipment type not found or inactive");
          await lockAndCheckEquipment(tx, e.equipmentTypeId, e.quantity, startAt, endAt);
        }

        const priceBreakdown = quotePrice({
          startAt,
          endAt,
          court,
          coach,
          equipment: sortedEquipment.map((e) => ({ equipmentType: equipmentTypesById.get(e.equipmentTypeId)!, quantity: e.quantity })),
          pricingRules,
        });

        const booking = await tx.booking.create({
          data: {
            customerName,
            customerEmail,
            startAt,
            endAt,
            status: "CONFIRMED",
            priceTotalCents: priceBreakdown.totalCents,
            priceBreakdown: priceBreakdown as unknown as Prisma.InputJsonValue,
            court: {
              create: {
                courtId: court.id,
                startAt,
                endAt,
              },
            },
            coach: coach
              ? {
                  create: {
                    coachId: coach.id,
                    startAt,
                    endAt,
                  },
                }
              : undefined,
            equipment: sortedEquipment.length
              ? {
                  create: sortedEquipment.map((e) => ({
                    equipmentTypeId: e.equipmentTypeId,
                    quantity: e.quantity,
                    startAt,
                    endAt,
                  })),
                }
              : undefined,
          },
          select: { id: true },
        });

        return {
          bookingId: booking.id,
          priceTotalCents: priceBreakdown.totalCents,
          priceBreakdown,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (err) {
    if (isOverlapConstraintError(err) || err instanceof EquipmentUnavailableError) {
      throw new ResourceUnavailableError("One or more selected resources are unavailable for that slot.");
    }

    throw err;
  }
}

export async function cancelBooking(bookingId: string) {
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          court: { include: { court: true } },
        },
      });

      if (!booking) throw new Error("Booking not found");
      if (booking.status === "CANCELLED") return { ok: true };

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
        },
      });

      // Remove join rows so the exclusion constraints no longer block the slot.
      await Promise.all([
        tx.bookingCourt.deleteMany({ where: { bookingId } }),
        tx.bookingCoach.deleteMany({ where: { bookingId } }),
        tx.bookingEquipment.deleteMany({ where: { bookingId } }),
      ]);

      const surface = booking.court?.court.surface;
      if (surface) {
        await notifyNextWaitlistForSlot(tx, {
          startAt: booking.startAt,
          endAt: booking.endAt,
          surface,
        });
      }

      return { ok: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

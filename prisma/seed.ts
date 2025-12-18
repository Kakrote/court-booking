import dotenv from "dotenv";
import { PrismaClient, CourtSurface, DayType, PricingAppliesTo } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";

dotenv.config({ override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

let ssl: false | { rejectUnauthorized: boolean } = false;
try {
  const u = new URL(databaseUrl);
  const sslmode = u.searchParams.get("sslmode");
  const sslParam = u.searchParams.get("ssl");
  if (sslmode === "require" || sslParam === "true") {
    ssl = { rejectUnauthorized: false };
  }
} catch {
  // ignore
}

const pool = new Pool({ connectionString: databaseUrl, ssl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function time(hhmm: string) {
  // Stored as TIME in Postgres; the date part is ignored.
  return new Date(`1970-01-01T${hhmm}:00`);
}

async function main() {
  const adminEmail = String(process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD ?? "admin123");
  const adminName = String(process.env.ADMIN_NAME ?? "Admin").trim() || "Admin";

  if (!process.env.ADMIN_JWT_SECRET) {
    console.warn("[seed] ADMIN_JWT_SECRET is not set. Admin login will be blocked by middleware.");
  }

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      isActive: true,
      passwordHash: await hash(adminPassword, 10),
    },
    create: {
      email: adminEmail,
      name: adminName,
      isActive: true,
      passwordHash: await hash(adminPassword, 10),
    },
  });

  await prisma.facilityConfig.upsert({
    where: { id: "default" },
    update: {
      timezone: "local",
      openTime: time("06:00"),
      closeTime: time("22:00"),
      slotMinutes: 60,
    },
    create: {
      id: "default",
      timezone: "local",
      openTime: time("06:00"),
      closeTime: time("22:00"),
      slotMinutes: 60,
    },
  });

  const courts = [
    { name: "Badminton Court 1 (Indoor)", surface: CourtSurface.INDOOR },
    { name: "Badminton Court 2 (Indoor)", surface: CourtSurface.INDOOR },
    { name: "Badminton Court 3 (Outdoor)", surface: CourtSurface.OUTDOOR },
    { name: "Badminton Court 4 (Outdoor)", surface: CourtSurface.OUTDOOR },
  ];

  for (const court of courts) {
    await prisma.court.upsert({
      where: { name: court.name },
      update: {
        surface: court.surface,
        isActive: true,
        baseRateCentsPerHour: 600,
      },
      create: {
        name: court.name,
        surface: court.surface,
        isActive: true,
        baseRateCentsPerHour: 600,
      },
    });
  }

  const equipmentTypes = [
    { name: "Racket", unitPriceCents: 100, totalQuantity: 10 },
    { name: "Shoes", unitPriceCents: 150, totalQuantity: 20 },
  ];

  for (const eq of equipmentTypes) {
    await prisma.equipmentType.upsert({
      where: { name: eq.name },
      update: { ...eq, isActive: true },
      create: { ...eq, isActive: true },
    });
  }

  const coaches = [
    { name: "Coach A", hourlyRateCents: 600 },
    { name: "Coach B", hourlyRateCents: 700 },
    { name: "Coach C", hourlyRateCents: 500 },
  ];

  const coachRecords = [] as { id: string; name: string }[];
  for (const coach of coaches) {
    const record = await prisma.coach.upsert({
      where: { name: coach.name },
      update: { ...coach, isActive: true },
      create: { ...coach, isActive: true },
      select: { id: true, name: true },
    });
    coachRecords.push(record);
  }

  // Reset availability (seed is deterministic)
  await prisma.coachAvailability.deleteMany({});

  const [coachA, coachB, coachC] = coachRecords;

  // dayOfWeek: 0=Sun ... 6=Sat
  await prisma.coachAvailability.createMany({
    data: [
      // Coach A: weekdays evenings
      ...[1, 2, 3, 4, 5].map((dow) => ({
        coachId: coachA.id,
        dayOfWeek: dow,
        startTime: time("16:00"),
        endTime: time("21:00"),
        isActive: true,
      })),
      // Coach B: weekends morning + evening
      ...[0, 6].flatMap((dow) => [
        {
          coachId: coachB.id,
          dayOfWeek: dow,
          startTime: time("08:00"),
          endTime: time("12:00"),
          isActive: true,
        },
        {
          coachId: coachB.id,
          dayOfWeek: dow,
          startTime: time("16:00"),
          endTime: time("20:00"),
          isActive: true,
        },
      ]),
      // Coach C: daily early morning
      ...[0, 1, 2, 3, 4, 5, 6].map((dow) => ({
        coachId: coachC.id,
        dayOfWeek: dow,
        startTime: time("06:00"),
        endTime: time("10:00"),
        isActive: true,
      })),
    ],
  });

  // Reset pricing rules (seed is deterministic)
  await prisma.pricingRule.deleteMany({});

  await prisma.pricingRule.createMany({
    data: [
      {
        name: "Peak hours (6-9 PM)",
        isActive: true,
        priority: 10,
        appliesTo: PricingAppliesTo.COURT,
        dayType: DayType.ANY,
        startTime: time("18:00"),
        endTime: time("21:00"),
        multiplierBps: 13000,
        addCents: 0,
      },
      {
        name: "Weekend premium",
        isActive: true,
        priority: 20,
        appliesTo: PricingAppliesTo.COURT,
        dayType: DayType.WEEKEND,
        multiplierBps: 12000,
        addCents: 0,
      },
      {
        name: "Indoor court premium",
        isActive: true,
        priority: 30,
        appliesTo: PricingAppliesTo.COURT,
        dayType: DayType.ANY,
        courtSurface: CourtSurface.INDOOR,
        multiplierBps: 12000,
        addCents: 0,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

# Court Booking Platform (Badminton)

Full-stack court booking system for a badminton facility with:

- 4 courts (2 indoor, 2 outdoor)
- Rentable equipment with limited quantities
- 3 coaches with weekly availability

Built with Next.js (App Router) + Prisma + PostgreSQL.

## Live demo

- https://court-booking-s37y.vercel.app/

## Features

### Booking flow

- View available time slots for a selected date
- Book a court (required)
- Add equipment rentals (optional, quantity-limited)
- Add a coach (optional, availability-limited)
- Live pricing quote with a breakdown before confirming
- Booking history page (by email) with cancellation

### Atomic multi-resource booking

Bookings are created **all-or-nothing** in a database transaction:

- Court + coach overlaps are prevented at the database level.
- Equipment inventory is protected with row locking and overlap checks.

If any resource is unavailable, the booking fails with a conflict.

### Dynamic pricing (rule-driven)

Pricing is not hardcoded. Admin-managed `PricingRule` rows can stack:

- Time window rules (e.g. peak 6–9 PM)
- Day type rules (weekday/weekend)
- Indoor/outdoor filters
- Plus coach and equipment fees

The app returns a price breakdown including which rules were applied.

### Waitlist + notifications

- If a slot is unavailable, users can join a waitlist queue
- On cancellation, the next waitlist entry for that slot is notified (stored in DB notifications)

### Admin panel (protected)

Admin can manage:

- Courts
- Equipment types (price + total quantity)
- Coaches + weekly availability
- Pricing rules (enable/disable, priority ordering)

Admin access requires login and is protected via middleware.

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL
- Prisma ORM (with `@prisma/adapter-pg` + `pg` Pool)
- JWT session cookie for admin auth (`jose`)
- Password hashing (`bcryptjs`)

## Database design (high-level)

- `Booking` stores the customer details, time range, total price, and JSON breakdown.
- Join tables represent the booked resources:
	- `BookingCourt` (1 court per booking)
	- `BookingCoach` (0/1 coach per booking)
	- `BookingEquipment` (0..N equipment lines with quantities)
- `PricingRule` stores admin-configurable pricing adjustments.
- `WaitlistEntry` is a FIFO queue per slot preference.
- `Notification` stores outbound notification payloads.

Concurrency safety:

- Postgres exclusion constraints prevent overlapping bookings for courts and coaches.
- Equipment uses a transaction with row locks and checks overlapping reservations.

## Environment variables

This repo ignores `.env*` by default. Create a local `.env`.

Required:

- `DATABASE_URL` (Postgres connection string)
- `ADMIN_JWT_SECRET` (long random secret used to sign the admin session cookie)

Seeded admin defaults (used by `npm run db:seed`):

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

## Run locally

### Option A (recommended): Docker Postgres

1) Start Postgres via Docker:

```bash
docker compose up -d
```

2) Set `.env`:

```dotenv
DATABASE_URL="postgresql://postgres:root@localhost:5433/court_booking4"
ADMIN_JWT_SECRET="change-me-to-a-long-random-secret"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"
ADMIN_NAME="Admin"
```

3) Install deps + generate Prisma client:

```bash
npm install
```

4) Apply migrations and seed:

```bash
npx prisma migrate dev
npm run db:seed
```

5) Run the app:

```bash
npm run dev
```

Open:

- App: http://localhost:3000
- Admin login: http://localhost:3000/admin/login

### Option B: Prisma-hosted Postgres (sslmode=require)

If your `DATABASE_URL` includes `sslmode=require` (managed Postgres), the app enables SSL automatically for the `pg` Pool.

Run migrations + seed once:

```bash
npx prisma migrate deploy
npm run db:seed
```

## Admin login

1) Go to `/admin/login`
2) Sign in using the seeded admin credentials from `.env`
3) Use “Logout” in the admin header to clear the session

## Scripts

- `npm run dev` – dev server
- `npm run build` – production build (runs `prisma generate` first)
- `npm run start` – run production server
- `npm run lint` – lint
- `npm run db:seed` – seed courts/equipment/coaches/pricing/admin

## Deploy to Vercel

This project is deployed on Vercel and uses Vercel Storage for its managed database.

1) Add env vars in Vercel → Project Settings → Environment Variables:

- `DATABASE_URL`
- `ADMIN_JWT_SECRET`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`

2) Build command should remain `npm run build`.

3) Run migrations + seed against the hosted DB from your machine (one-time):

```bash
npx prisma migrate deploy
npm run db:seed
```

-- Prevent double-booking for courts and coaches using overlap-safe constraints.
-- We keep startAt/endAt on the join tables to enforce these constraints directly.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "BookingCourt"
ADD CONSTRAINT "BookingCourt_no_overlap"
EXCLUDE USING gist (
	"courtId" WITH =,
	tsrange("startAt", "endAt", '[)') WITH &&
);

ALTER TABLE "BookingCoach"
ADD CONSTRAINT "BookingCoach_no_overlap"
EXCLUDE USING gist (
	"coachId" WITH =,
	tsrange("startAt", "endAt", '[)') WITH &&
);
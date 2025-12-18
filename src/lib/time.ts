export function parseLocalDate(dateISO: string): Date {
  // Expects YYYY-MM-DD
  return new Date(`${dateISO}T00:00:00`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function timeFieldToMinutes(timeField: Date): number {
  // Prisma returns TIME columns as Date objects with an arbitrary date.
  return timeField.getHours() * 60 + timeField.getMinutes();
}

export function overlapsTimeWindow(
  startAt: Date,
  endAt: Date,
  windowStartMinutes: number,
  windowEndMinutes: number,
): boolean {
  // Assumes window does not wrap past midnight.
  const startMin = minutesOfDay(startAt);
  const endMin = minutesOfDay(endAt);
  return startMin < windowEndMinutes && endMin > windowStartMinutes;
}

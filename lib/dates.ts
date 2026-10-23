export type Stay = { id: string; start: string; end?: string; note?: string };
export type Cycle = { start: string; end: string };

const DAY = 86_400_000;
const HOUR = 3_600_000;

export function fromISO(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function toLocalInput(instant: string): string {
  const date = new Date(instant);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localInputToInstant(value: string): string {
  return new Date(value).toISOString();
}

export function legacyDateToInstant(value: string): string {
  return localInputToInstant(`${value}T00:00`);
}

export function isValidInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) && /T\d{2}:\d{2}/.test(value);
}

export function addDays(value: string, days: number): string {
  return toISO(new Date(fromISO(value).getTime() + days * DAY));
}

export function daysBetween(start: string, end: string): number {
  return Math.max(0, Math.round((fromISO(end).getTime() - fromISO(start).getTime()) / DAY));
}

function monthStart(year: number, monthIndex: number, cycleDay: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return toISO(new Date(Date.UTC(year, monthIndex, Math.min(cycleDay, lastDay))));
}

export function cycleFor(date: string, cycleDay: number, offset = 0): Cycle {
  const parsed = fromISO(date);
  let monthIndex = parsed.getUTCMonth();
  let year = parsed.getUTCFullYear();
  if (date.slice(0, 10) < monthStart(year, monthIndex, cycleDay)) monthIndex -= 1;
  monthIndex += offset;
  const anchor = new Date(Date.UTC(year, monthIndex, 1));
  year = anchor.getUTCFullYear();
  monthIndex = anchor.getUTCMonth();
  return {
    start: monthStart(year, monthIndex, cycleDay),
    end: monthStart(year, monthIndex + 1, cycleDay)
  };
}

export function billableDays(stay: Stay, now: string): number {
  const end = new Date(stay.end ?? now).getTime();
  const start = new Date(stay.start).getTime();
  const duration = Math.max(0, end - start);
  return duration <= 12 * HOUR ? 0 : Math.ceil(duration / DAY);
}

// Each rounded-up day is assigned to the date at the start of its 24-hour block.
// This keeps a stay crossing a bill boundary from being charged twice or lost.
export function stayDaysInCycle(stay: Stay, cycle: Cycle, now: string): number {
  const count = billableDays(stay, now);
  const start = new Date(stay.start).getTime();
  const cycleStart = new Date(`${cycle.start}T00:00`).getTime();
  const cycleEnd = new Date(`${cycle.end}T00:00`).getTime();
  let included = 0;
  for (let index = 0; index < count; index += 1) {
    const blockStart = start + index * DAY;
    if (blockStart >= cycleStart && blockStart < cycleEnd) included += 1;
  }
  return included;
}

export function totalDays(stays: Stay[], cycle: Cycle, now: string): number {
  return stays.reduce((total, stay) => total + stayDaysInCycle(stay, cycle, now), 0);
}

export function isStayedOn(stays: Stay[], date: string, now: string): boolean {
  const dayStart = new Date(`${date}T00:00`).getTime();
  const dayEnd = new Date(`${addDays(date, 1)}T00:00`).getTime();
  return stays.some((stay) => new Date(stay.start).getTime() < dayEnd && new Date(stay.end ?? now).getTime() > dayStart);
}

export function overlapsExisting(candidate: Stay, stays: Stay[], now: string): boolean {
  const candidateStart = new Date(candidate.start).getTime();
  const candidateEnd = new Date(candidate.end ?? now).getTime();
  return stays.some((stay) => stay.id !== candidate.id && candidateStart < new Date(stay.end ?? now).getTime() && new Date(stay.start).getTime() < candidateEnd);
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", ...options }).format(fromISO(value));
}

export function formatDateTime(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }): string {
  return new Intl.DateTimeFormat("en", options).format(new Date(value));
}

export function formatCycle(cycle: Cycle): string {
  return `${formatDate(cycle.start)} – ${formatDate(addDays(cycle.end, -1))}`;
}

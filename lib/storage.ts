import { isValidInstant, legacyDateToInstant, type Stay } from "./dates.ts";

export type BillKind = "electric" | "water";
export type BoardData = {
  name: string;
  electricDay: number;
  waterDay: number;
  electricRate: number;
  waterRate: number;
  currency: string;
  stays: Stay[];
};

export const STORAGE_KEY = "boardmark:v2";
export const LEGACY_KEY = "boardmark:v1";
export const INITIAL_DATA: BoardData = {
  name: "", electricDay: 1, waterDay: 7,
  electricRate: 0, waterRate: 0, currency: "LKR", stays: []
};

function cycleDay(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 31 ? Number(value) : fallback;
}

function rate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function normalizeData(input: unknown, version: 1 | 2): BoardData | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  if (!Array.isArray(source.stays)) return null;
  const stays: Stay[] = [];
  for (const item of source.stays) {
    if (!item || typeof item !== "object") return null;
    const stay = item as Record<string, unknown>;
    if (typeof stay.id !== "string" || typeof stay.start !== "string") return null;
    let start: string;
    let end: string | undefined;
    try {
      start = version === 1 && /^\d{4}-\d{2}-\d{2}$/.test(stay.start) ? legacyDateToInstant(stay.start) : stay.start;
      end = typeof stay.end === "string" ? (version === 1 && /^\d{4}-\d{2}-\d{2}$/.test(stay.end) ? legacyDateToInstant(stay.end) : stay.end) : undefined;
    } catch { return null; }
    if (!isValidInstant(start) || (end && !isValidInstant(end)) || (end && end < start)) return null;
    stays.push({ id: stay.id, start, ...(end ? { end } : {}), ...(typeof stay.note === "string" ? { note: stay.note.slice(0, 100) } : {}) });
  }
  return {
    name: typeof source.name === "string" ? source.name.slice(0, 40) : "",
    electricDay: cycleDay(version === 1 ? source.cycleDay : source.electricDay, 1),
    waterDay: cycleDay(source.waterDay, 7),
    electricRate: rate(version === 1 ? source.dailyRate : source.electricRate),
    waterRate: rate(source.waterRate),
    currency: typeof source.currency === "string" && source.currency.length <= 6 ? source.currency : "LKR",
    stays
  };
}

export function readData(): BoardData {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeData(JSON.parse(current), 2) ?? INITIAL_DATA;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return normalizeData(JSON.parse(legacy), 1) ?? INITIAL_DATA;
  } catch { /* Invalid local data falls back to an empty tracker. */ }
  return INITIAL_DATA;
}

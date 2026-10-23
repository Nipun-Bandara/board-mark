import assert from "node:assert/strict";
import test from "node:test";
import { billableDays, cycleFor, isStayedOn, legacyDateToInstant, overlapsExisting, stayDaysInCycle, totalDays } from "../lib/dates.ts";
import { normalizeData } from "../lib/storage.ts";

const instant = (local: string) => new Date(local).toISOString();

test("electric and water cycles can start on different days", () => {
  assert.deepEqual(cycleFor("2025-03-02", 1), { start: "2025-03-01", end: "2025-04-01" });
  assert.deepEqual(cycleFor("2025-03-02", 7), { start: "2025-02-07", end: "2025-03-07" });
  assert.deepEqual(cycleFor("2025-02-28", 31), { start: "2025-02-28", end: "2025-03-31" });
});

test("12 hours does not count; over 12 hours rounds up by 24-hour days", () => {
  const start = instant("2025-04-10T08:00");
  assert.equal(billableDays({ id: "a", start, end: instant("2025-04-10T19:59") }, start), 0);
  assert.equal(billableDays({ id: "a", start, end: instant("2025-04-10T20:00") }, start), 0);
  assert.equal(billableDays({ id: "a", start, end: instant("2025-04-10T20:01") }, start), 1);
  assert.equal(billableDays({ id: "a", start, end: instant("2025-04-11T08:00") }, start), 1);
  assert.equal(billableDays({ id: "a", start, end: instant("2025-04-11T08:01") }, start), 2);
});

test("a stay crossing a cycle boundary is allocated once", () => {
  const stay = { id: "a", start: instant("2025-04-30T18:00"), end: instant("2025-05-01T07:00") };
  const now = instant("2025-05-01T07:00");
  assert.equal(stayDaysInCycle(stay, { start: "2025-04-01", end: "2025-05-01" }, now), 1);
  assert.equal(stayDaysInCycle(stay, { start: "2025-05-01", end: "2025-06-01" }, now), 0);
  assert.equal(isStayedOn([stay], "2025-05-01", now), true);
});

test("open stays grow with time and old date records migrate to midnight", () => {
  const stay = { id: "a", start: instant("2025-05-06T18:00") };
  assert.equal(totalDays([stay], { start: "2025-05-01", end: "2025-06-01" }, instant("2025-05-07T06:00")), 0);
  assert.equal(totalDays([stay], { start: "2025-05-01", end: "2025-06-01" }, instant("2025-05-07T06:01")), 1);
  assert.equal(legacyDateToInstant("2025-05-06"), instant("2025-05-06T00:00"));
});

test("overlapping timed stays are rejected", () => {
  const existing = [{ id: "a", start: instant("2025-05-06T08:00"), end: instant("2025-05-06T18:00") }];
  assert.equal(overlapsExisting({ id: "b", start: instant("2025-05-06T17:00"), end: instant("2025-05-06T20:00") }, existing, instant("2025-05-06T20:00")), true);
  assert.equal(overlapsExisting({ id: "b", start: instant("2025-05-06T18:00"), end: instant("2025-05-06T20:00") }, existing, instant("2025-05-06T20:00")), false);
});

test("old browser records preserve stays and settings during migration", () => {
  const migrated = normalizeData({
    name: "Nipun", cycleDay: 5, dailyRate: 250, currency: "LKR",
    stays: [{ id: "old", start: "2025-05-06", end: "2025-05-08" }]
  }, 1);
  assert.equal(migrated?.electricDay, 5);
  assert.equal(migrated?.waterDay, 7);
  assert.equal(migrated?.electricRate, 250);
  assert.equal(migrated?.waterRate, 0);
  assert.equal(migrated?.stays[0].start, instant("2025-05-06T00:00"));
  assert.equal(migrated?.stays[0].end, instant("2025-05-08T00:00"));
});

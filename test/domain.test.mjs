import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdherence,
  deriveSessionStatus,
  getIsoWeekday,
  makeOccurrence,
} from "../src/lib/domain.mjs";

test("a quick completion confirms attendance without measured performance", () => {
  assert.deepEqual(
    deriveSessionStatus({
      quickCompleted: true,
      exerciseStates: [],
    }),
    { status: "completed", measured: false },
  );
});

test("exercise states distinguish partial work from a complete workout", () => {
  assert.deepEqual(
    deriveSessionStatus({
      quickCompleted: false,
      exerciseStates: ["completed", "skipped", "in-progress"],
    }),
    { status: "partial", measured: false },
  );
  assert.deepEqual(
    deriveSessionStatus({
      quickCompleted: false,
      exerciseStates: ["completed", "completed"],
    }),
    { status: "completed", measured: false },
  );
});

test("plan occurrences use ISO weekdays and preserve their date", () => {
  assert.equal(getIsoWeekday("2026-08-20"), 4);
  assert.deepEqual(
    makeOccurrence("2026-08-20", {
      4: { kind: "block", blockId: 1 },
    }),
    {
      plannedDate: "2026-08-20",
      dayOfWeek: 4,
      kind: "block",
      blockId: 1,
      cardioDesc: null,
    },
  );
});

test("adherence excludes rest days from the denominator", () => {
  assert.deepEqual(
    calculateAdherence([
      { kind: "rest", status: "planned" },
      { kind: "block", status: "completed" },
      { kind: "cardio", status: "partial" },
      { kind: "block", status: "skipped" },
    ]),
    {
      planned: 3,
      completed: 1,
      partial: 1,
      skipped: 1,
      rescheduled: 0,
      percentage: 33,
    },
  );
});

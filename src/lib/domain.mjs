const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getIsoWeekday(date) {
  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  const day = parsed.getUTCDay();
  return day === 0 ? 7 : day;
}

export function makeOccurrence(plannedDate, weeklyPlan) {
  const weekday = getIsoWeekday(plannedDate);
  const assignment = weeklyPlan[weekday] ?? { kind: "rest" };

  return {
    plannedDate,
    dayOfWeek: weekday,
    kind: assignment.kind,
    blockId: assignment.blockId ?? null,
    cardioDesc: assignment.cardioDesc ?? null,
  };
}

export function deriveSessionStatus({ quickCompleted = false, exerciseStates = [] }) {
  if (quickCompleted) {
    return { status: "completed", measured: false };
  }

  if (exerciseStates.length === 0) {
    return { status: "in-progress", measured: false };
  }

  const completedCount = exerciseStates.filter((state) => state === "completed").length;
  const skippedCount = exerciseStates.filter((state) => state === "skipped").length;

  if (completedCount === exerciseStates.length) {
    return { status: "completed", measured: false };
  }

  if (skippedCount === exerciseStates.length) {
    return { status: "skipped", measured: false };
  }

  if (completedCount > 0 || skippedCount > 0) {
    return { status: "partial", measured: false };
  }

  return { status: "in-progress", measured: false };
}

export function calculateAdherence(occurrences) {
  const actionable = occurrences.filter((occurrence) => occurrence.kind !== "rest");
  const counts = {
    planned: actionable.length,
    completed: actionable.filter((item) => item.status === "completed").length,
    partial: actionable.filter((item) => item.status === "partial").length,
    skipped: actionable.filter((item) => item.status === "skipped").length,
    rescheduled: actionable.filter((item) => item.status === "rescheduled").length,
  };

  return {
    ...counts,
    percentage: counts.planned === 0 ? 100 : Math.round((counts.completed / counts.planned) * 100),
  };
}

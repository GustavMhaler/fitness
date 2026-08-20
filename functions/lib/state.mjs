import { makeOccurrence } from "../../src/lib/domain.mjs";

const DEFAULT_SETTINGS = {
  timezone: "Asia/Shanghai",
  weekStartsOn: 1,
  defaultUnit: "kg",
  defaultRestDuration: 90,
};

const seedBlocks = [
  { id: "block-a", name: "A 上肢推", category: "push", description: "胸、三头和核心", archived: false },
  { id: "block-b", name: "B 上肢拉", category: "pull", description: "背、后链和核心", archived: false },
  { id: "block-c", name: "C 下肢", category: "legs", description: "腿、臀和核心", archived: false },
];

const seedExercises = [
  ["exercise-1", "block-a", "标准俯卧撑", "胸", 2, "力竭", "趁体力先做;做不动转上斜"],
  ["exercise-2", "block-a", "上斜俯卧撑", "胸", 3, "12", "身体45°;第3组做不满可减到8-10"],
  ["exercise-3", "block-a", "俯卧撑顶端支撑", "三头", 3, "15秒", "撑起位静止;一条直线,别塌腰"],
  ["exercise-4", "block-a", "平板支撑", "核心", 3, "30秒", "臀部夹紧,别耸肩"],
  ["exercise-5", "block-a", "仰卧起坐", "核心", 3, "20", ""],
  ["exercise-6", "block-b", "桌子划船", "背", 4, "10", "桌下水平引体;身体越水平越难"],
  ["exercise-7", "block-b", "超人式", "下背", 3, "12", "俯卧抬臂腿,顶峰停顿1秒"],
  ["exercise-8", "block-b", "平板支撑", "核心", 3, "30秒", ""],
  ["exercise-9", "block-b", "仰卧起坐", "核心", 3, "20", ""],
  ["exercise-10", "block-c", "深蹲", "腿", 3, "20", "脚跟踩实,膝盖朝脚尖,蹲到大腿平行"],
  ["exercise-11", "block-c", "弓步蹲", "腿", 3, "10/腿", "前膝不过脚尖,不稳扶墙"],
  ["exercise-12", "block-c", "臀桥", "臀", 3, "15", "顶端夹臀停1秒"],
  ["exercise-13", "block-c", "提踵", "小腿", 3, "20", ""],
  ["exercise-14", "block-c", "平板支撑", "核心", 3, "30秒", ""],
  ["exercise-15", "block-c", "仰卧起坐", "核心", 3, "20", ""],
].map(([id, blockId, name, targetPart, sets, reps, note], sortOrder) => ({
  id,
  blockId,
  name,
  targetPart,
  sets,
  reps,
  note,
  archived: false,
  custom: false,
  sortOrder,
}));

const seedWeeklyPlan = {
  1: { kind: "cardio", cardioDesc: "跑步 3km 或划船 20-22min", blockId: null },
  2: { kind: "block", cardioDesc: null, blockId: "block-c" },
  3: { kind: "rest", cardioDesc: "散步/拉伸", blockId: null },
  4: { kind: "block", cardioDesc: null, blockId: "block-a" },
  5: { kind: "cardio", cardioDesc: "跑步 4km 或划船 25min", blockId: null },
  6: { kind: "block", cardioDesc: null, blockId: "block-b" },
  7: { kind: "rest", cardioDesc: null, blockId: null },
};

export function createEmptyState() {
  return {
    initialized: false,
    access: { overrideHash: null, overrideSalt: null, authVersion: 1 },
    backup: { lastExportAt: null },
    settings: structuredClone(DEFAULT_SETTINGS),
    weeklyPlan: {},
    planSnapshots: [],
    blocks: [],
    exercises: [],
    occurrences: {},
    sessions: [],
    records: [],
    goals: [],
  };
}

export function createSeedState() {
  return {
    ...createEmptyState(),
    initialized: true,
    settings: structuredClone(DEFAULT_SETTINGS),
    weeklyPlan: structuredClone(seedWeeklyPlan),
    blocks: structuredClone(seedBlocks),
    exercises: structuredClone(seedExercises),
    goals: [
      { id: "goal-1", text: "深蹲 20×4 轻松", deadline: "", notes: "", achieved: false },
      { id: "goal-2", text: "标准俯卧撑一组 ≥ 6 个", deadline: "", notes: "", achieved: false },
      { id: "goal-3", text: "3km 跑进 22 分钟", deadline: "", notes: "", achieved: false },
      { id: "goal-4", text: "单杠悬垂 ≥ 15 秒", deadline: "", notes: "", achieved: false },
    ],
  };
}

export function nextId(prefix, collection) {
  const existing = new Set(collection.map((item) => item.id));
  let counter = 1;
  let id = `${prefix}-${counter}`;
  while (existing.has(id)) {
    counter += 1;
    id = `${prefix}-${counter}`;
  }
  return id;
}

export function getOccurrence(state, plannedDate) {
  if (state.occurrences[plannedDate]) {
    return state.occurrences[plannedDate];
  }

  const snapshots = [...(state.planSnapshots || [])].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  const snapshot = snapshots.filter((item) => item.effectiveFrom <= plannedDate).at(-1);
  const occurrence = makeOccurrence(plannedDate, snapshot?.weeklyPlan || state.weeklyPlan);
  return {
    ...occurrence,
    status: occurrence.kind === "rest" ? "rest" : "planned",
  };
}

export function materializeOccurrences(state, fromDate, days = 150) {
  let date = fromDate;
  for (let index = 0; index < days; index += 1) {
    if (!state.occurrences[date]) {
      const occurrence = makeOccurrence(date, state.weeklyPlan);
      state.occurrences[date] = { ...occurrence, status: occurrence.kind === "rest" ? "rest" : "planned" };
    }
    date = addDays(date, 1);
  }
}

export function listOccurrences(state, fromDate, days = 14) {
  const result = [];
  let date = fromDate;
  for (let index = 0; index < days; index += 1) {
    const occurrence = getOccurrence(state, date);
    const session = state.sessions.find((item) => item.plannedDate === date);
    result.push({
      ...occurrence,
      status: session?.rescheduled ? "rescheduled" : session?.status ?? occurrence.status,
      sessionId: session?.id ?? null,
      actualDate: session?.actualDate ?? null,
    });
    date = addDays(date, 1);
  }
  return result;
}

export function startOfWeek(date, weekStartsOn = 1) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  const offset = (weekday - Number(weekStartsOn) + 7) % 7;
  return addDays(date, -offset);
}

export function addDays(date, amount) {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + amount);
  return current.toISOString().slice(0, 10);
}

export function getToday(timeZone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function summarizeState(state) {
  return {
    ...state,
    blocks: state.blocks.filter((block) => !block.archived),
    exercises: state.exercises.filter((exercise) => !exercise.archived),
    allExercises: state.exercises,
  };
}

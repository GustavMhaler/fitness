import { calculateAdherence, makeOccurrence } from "../../src/lib/domain.mjs";
import {
  addDays,
  createEmptyState,
  createSeedState,
  getOccurrence,
  getToday,
  listOccurrences,
  materializeOccurrences,
  nextId,
  startOfWeek,
  summarizeState,
} from "./state.mjs";
import { ConflictError, D1Store, MemoryStore } from "./store.mjs";

const COOKIE_NAME = "fitness_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();
const fallbackStore = new MemoryStore();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function parseCookie(request, name) {
  const header = request.headers.get("cookie") ?? "";
  const pair = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function hashPasscode(passcode, salt) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${passcode}`));
  return toBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function getPasscodeHash(passcode, salt) {
  return hashPasscode(passcode, salt);
}

async function verifyPasscode(passcode, state, configuredPasscode) {
  if (!state.access?.overrideHash && configuredPasscode && constantTimeEqual(passcode, configuredPasscode)) return true;
  if (!state.access?.overrideHash || !state.access.overrideSalt) return false;
  const candidate = await getPasscodeHash(passcode, state.access.overrideSalt);
  return constantTimeEqual(candidate, state.access.overrideHash);
}

async function issueToken(secret, authVersion) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${authVersion}`;
  return `${payload}.${await sign(secret, payload)}`;
}

async function verifyToken(token, secret, authVersion) {
  if (!token) return false;
  const [timestamp, version, signature] = token.split(".");
  const issuedAt = Number(timestamp);
  if (!issuedAt || !version || !signature || Date.now() / 1000 - issuedAt > MAX_AGE_SECONDS) return false;
  if (Number(version) !== Number(authVersion)) return false;
  const expected = await sign(secret, `${timestamp}.${version}`);
  return constantTimeEqual(expected, signature);
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function expectedVersion(body, request) {
  return body.expectedVersion ?? request.headers.get("if-match")?.replaceAll('"', "");
}

function clientData(state, version, date) {
  const today = date || getToday(state.settings.timezone);
  const weekStart = startOfWeek(today, state.settings.weekStartsOn);
  return {
    version,
    today,
    weekStart,
    ...summarizeState(state),
    occurrences: listOccurrences(state, weekStart, 14),
  };
}

function validateState(value) {
  if (!value || typeof value !== "object") throw new Error("备份格式无效");
  for (const key of ["settings", "weeklyPlan", "blocks", "exercises", "sessions", "records", "goals"]) {
    if (!(key in value)) throw new Error(`备份缺少 ${key}`);
  }
  if (typeof value.settings !== "object" || typeof value.weeklyPlan !== "object") throw new Error("备份设置或周计划格式无效");
  for (const key of ["blocks", "exercises", "sessions", "records", "goals"]) if (!Array.isArray(value[key])) throw new Error(`备份字段 ${key} 必须是数组`);
}

function mergeStates(current, incoming) {
  const merged = structuredClone(current);
  merged.initialized = true;
  merged.settings = { ...merged.settings, ...incoming.settings };
  merged.weeklyPlan = { ...merged.weeklyPlan, ...incoming.weeklyPlan };
  merged.planSnapshots = incoming.planSnapshots ?? merged.planSnapshots;
  for (const key of ["blocks", "exercises", "sessions", "records", "goals"]) {
    const byId = new Map(merged[key].map((item) => [item.id, item]));
    for (const item of incoming[key]) byId.set(item.id, item);
    merged[key] = [...byId.values()];
  }
  merged.occurrences = { ...merged.occurrences, ...(incoming.occurrences ?? {}) };
  return merged;
}

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function recalculateSession(state, session) {
  if (!session || session.quickCompleted || session.status === "skipped") return;
  const occurrence = getOccurrence(state, session.plannedDate);
  const required = occurrence.blockId ? state.exercises.filter((exercise) => exercise.blockId === occurrence.blockId && !exercise.archived) : [];
  const performed = new Set(state.records.filter((record) => record.sessionId === session.id).map((record) => record.plannedExerciseId || record.exerciseId));
  session.status = required.length > 0 && required.every((exercise) => performed.has(exercise.id)) ? "completed" : performed.size > 0 ? "partial" : "in-progress";
}

function collectHistory(state, from, to, exerciseId) {
  const records = state.records.filter((record) => {
    if (exerciseId && record.exerciseId !== exerciseId) return false;
    if (from && record.actualDate < from) return false;
    if (to && record.actualDate > to) return false;
    return true;
  });
  const occurrenceDates = [];
  let cursor = from || addDays(to || getToday(state.settings.timezone), -30);
  const end = to || getToday(state.settings.timezone);
  while (cursor <= end) {
    occurrenceDates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  const occurrences = occurrenceDates.map((date) => {
    const occurrence = getOccurrence(state, date);
    const session = state.sessions.find((item) => item.plannedDate === date);
    return { ...occurrence, status: session?.rescheduled ? "rescheduled" : session?.status ?? occurrence.status };
  });
  const trendCounts = new Map();
  for (const record of records) trendCounts.set(record.exerciseId, (trendCounts.get(record.exerciseId) || 0) + 1);
  const trends = [...trendCounts.entries()].map(([id, count]) => ({
    name: findById(state.exercises, id)?.name || records.find((record) => record.exerciseId === id)?.exerciseName || "已归档动作",
    count,
  })).sort((left, right) => right.count - left.count).slice(0, 8);
  const frequency = new Set(state.sessions.filter((session) => {
    const date = session.actualDate || session.plannedDate;
    return date >= (from || "0000-00-00") && date <= (to || "9999-99-99") && session.status !== "skipped";
  }).map((session) => session.actualDate || session.plannedDate)).size;
  return { records, occurrences, adherence: calculateAdherence(occurrences), frequency, trends };
}

export function createApi(env = {}) {
  const store = env.store ?? (env.DB ? new D1Store(env.DB) : fallbackStore);
  const configuredPasscode = env.ACCESS_PASSPHRASE || (env.CF_PAGES ? null : "change-me");
  const tokenSecret = configuredPasscode || String(env.ACCESS_RECOVERY_TOKEN || "unconfigured");

  return {
    async fetch(request) {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/api\/?/, "");
      const method = request.method.toUpperCase();
      const body = method === "GET" ? {} : await readBody(request);

      try {
        const current = await store.read();

        if (path === "auth" && method === "POST") {
          if (!configuredPasscode) return json({ error: "服务端尚未配置访问口令" }, 503);
          const passcode = String(body.passcode ?? "");
          if (!(await verifyPasscode(passcode, current.state, configuredPasscode))) return json({ error: "访问口令不正确" }, 401);
          const token = await issueToken(tokenSecret, current.state.access?.authVersion ?? 1);
          const secure = url.protocol === "https:" ? "; Secure" : "";
          return json({ ok: true }, 200, { "set-cookie": `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Path=/${secure}` });
        }

        if (path === "auth/recover" && method === "POST") {
          if (!env.ACCESS_RECOVERY_TOKEN || !constantTimeEqual(String(body.recoveryToken || ""), String(env.ACCESS_RECOVERY_TOKEN))) return json({ error: "恢复凭据不正确" }, 403);
          const nextPasscode = String(body.newPasscode ?? "");
          if (nextPasscode.length < 6) return json({ error: "新口令至少需要 6 位" }, 400);
          const result = await store.update(async (state) => {
            const salt = crypto.randomUUID();
            state.access = { overrideSalt: salt, overrideHash: await getPasscodeHash(nextPasscode, salt), authVersion: (state.access?.authVersion ?? 1) + 1 };
          }, current.version);
          const token = await issueToken(tokenSecret, result.state.access.authVersion);
          return json({ ok: true }, 200, { "set-cookie": `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Path=/` });
        }

        const authenticated = await verifyToken(parseCookie(request, COOKIE_NAME), tokenSecret, current.state.access?.authVersion ?? 1);
        if (!authenticated) return json({ error: "请先输入访问口令" }, 401);

        if (path === "auth" && method === "DELETE") {
          return json({ ok: true }, 200, { "set-cookie": `${COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/` });
        }

        if (path === "auth/change" && method === "POST") {
          const nextPasscode = String(body.newPasscode ?? "");
          if (nextPasscode.length < 6) return json({ error: "新口令至少需要 6 位" }, 400);
          if (!(await verifyPasscode(String(body.currentPasscode ?? ""), current.state, configuredPasscode))) return json({ error: "当前口令不正确" }, 403);
          const result = await store.update(async (state) => {
            const salt = crypto.randomUUID();
            state.access = { overrideSalt: salt, overrideHash: await getPasscodeHash(nextPasscode, salt), authVersion: (state.access?.authVersion ?? 1) + 1 };
          }, current.version);
          const token = await issueToken(tokenSecret, result.state.access.authVersion);
          return json({ ok: true }, 200, { "set-cookie": `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Path=/` });
        }

        if (path === "bootstrap" && method === "GET") {
          return json(clientData(current.state, current.version, url.searchParams.get("date")));
        }

        if (path === "initialize" && method === "POST") {
          if (current.state.initialized) return json({ error: "应用已经初始化" }, 409);
          const mode = body.mode === "seed" ? "seed" : "blank";
          const result = await store.update((state) => {
            Object.assign(state, mode === "seed" ? createSeedState() : { ...createEmptyState(), initialized: true });
            const today = getToday(state.settings.timezone);
            state.planSnapshots = [{ effectiveFrom: today, weeklyPlan: structuredClone(state.weeklyPlan) }];
            materializeOccurrences(state, addDays(today, -30));
          }, current.version);
          return json(clientData(result.state, result.version));
        }

        if (path === "settings" && method === "PUT") {
          const result = await store.update((state) => {
            state.settings = { ...state.settings, ...body.settings };
          }, expectedVersion(body, request));
          return json({ settings: result.state.settings, version: result.version });
        }

        if (path === "plan" && method === "PUT") {
          const result = await store.update((state) => {
            const next = body.weeklyPlan ?? body.days;
            if (!next || typeof next !== "object") throw new Error("周计划格式无效");
            const today = getToday(state.settings.timezone);
            const lastSnapshot = state.planSnapshots?.at(-1);
            if (!lastSnapshot || lastSnapshot.effectiveFrom !== today) {
              state.planSnapshots = [...(state.planSnapshots || []), { effectiveFrom: today, weeklyPlan: structuredClone(state.weeklyPlan) }];
            }
            state.weeklyPlan = Object.fromEntries(Array.from({ length: 7 }, (_, index) => {
              const day = String(index + 1);
              const item = next[day] ?? next[index + 1] ?? { kind: "rest" };
              return [day, { kind: item.kind, blockId: item.blockId ?? null, cardioDesc: item.cardioDesc ?? null }];
            }));
            for (const date of Object.keys(state.occurrences)) {
              if (date > today) {
                const occurrence = makeOccurrence(date, state.weeklyPlan);
                state.occurrences[date] = { ...occurrence, status: occurrence.kind === "rest" ? "rest" : "planned" };
              }
            }
          }, expectedVersion(body, request));
          return json(clientData(result.state, result.version));
        }

        const blockMatch = path.match(/^blocks(?:\/([^/]+))?$/);
        if (blockMatch && method === "POST") {
          const result = await store.update((state) => {
            if (blockMatch[1] && body.duplicate) {
              const source = findById(state.blocks, blockMatch[1]);
              if (!source) throw new Error("训练块不存在");
              const block = { ...source, id: nextId("block", state.blocks), name: `${source.name}（副本）`, archived: false };
              state.blocks.push(block);
              const copiedExercises = [];
              for (const exercise of state.exercises.filter((item) => item.blockId === source.id)) {
                copiedExercises.push({ ...exercise, id: nextId("exercise", [...state.exercises, ...copiedExercises]), blockId: block.id, custom: true });
              }
              state.exercises.push(...copiedExercises);
              return { block, exercises: copiedExercises };
            }
            const block = {
              id: nextId("block", state.blocks),
              name: String(body.name || "新训练块"),
              category: String(body.category || "custom"),
              description: String(body.description || ""),
              archived: false,
            };
            state.blocks.push(block);
            return block;
          }, expectedVersion(body, request));
          return json({ ...(blockMatch[1] && body.duplicate ? result.result : { block: result.result }), version: result.version }, 201);
        }
        if (blockMatch && blockMatch[1] && method === "PUT") {
          const result = await store.update((state) => {
            const block = findById(state.blocks, blockMatch[1]);
            if (!block) throw new Error("训练块不存在");
            Object.assign(block, { name: body.name ?? block.name, category: body.category ?? block.category, description: body.description ?? block.description });
            return block;
          }, expectedVersion(body, request));
          return json({ block: result.result, version: result.version });
        }
        if (blockMatch && blockMatch[1] && method === "DELETE") {
          const result = await store.update((state) => {
            const block = findById(state.blocks, blockMatch[1]);
            if (!block) throw new Error("训练块不存在");
            block.archived = true;
          }, expectedVersion(body, request));
          return json({ ok: true, version: result.version });
        }

        const exerciseMatch = path.match(/^exercises(?:\/([^/]+))?$/);
        if (exerciseMatch && method === "POST") {
          const result = await store.update((state) => {
            const exercise = {
              id: nextId("exercise", state.exercises),
              blockId: body.blockId || null,
              name: String(body.name || "新动作"),
              targetPart: String(body.targetPart || ""),
              sets: body.sets ? Number(body.sets) : null,
              reps: String(body.reps || ""),
              note: String(body.note || ""),
              archived: false,
              custom: true,
              sortOrder: state.exercises.length,
            };
            state.exercises.push(exercise);
            return exercise;
          }, expectedVersion(body, request));
          return json({ exercise: result.result, version: result.version }, 201);
        }
        if (exerciseMatch && exerciseMatch[1] && method === "PUT") {
          const result = await store.update((state) => {
            const exercise = findById(state.exercises, exerciseMatch[1]);
            if (!exercise) throw new Error("动作不存在");
            for (const key of ["blockId", "name", "targetPart", "sets", "reps", "note"]) if (body[key] !== undefined) exercise[key] = body[key];
            return exercise;
          }, expectedVersion(body, request));
          return json({ exercise: result.result, version: result.version });
        }
        if (exerciseMatch && exerciseMatch[1] && method === "DELETE") {
          const result = await store.update((state) => {
            const exercise = findById(state.exercises, exerciseMatch[1]);
            if (!exercise) throw new Error("动作不存在");
            exercise.archived = true;
          }, expectedVersion(body, request));
          return json({ ok: true, version: result.version });
        }

        if (path === "sessions" && method === "POST") {
          const result = await store.update((state) => {
            const duplicate = body.clientRequestId && state.sessions.find((item) => item.clientRequestId === body.clientRequestId);
            if (duplicate) return duplicate;
            const plannedDate = String(body.plannedDate || getToday(state.settings.timezone));
            const occurrence = getOccurrence(state, plannedDate);
            if (occurrence.kind === "rest") {
              const error = new Error("休息日不需要创建训练会话");
              error.status = 400;
              throw error;
            }
            state.occurrences[plannedDate] = state.occurrences[plannedDate] || { ...occurrence, status: "planned" };
            const existing = body.mode === "quick" && state.sessions.find((item) => item.plannedDate === plannedDate && item.quickCompleted);
            if (existing) return existing;
            const session = {
              id: nextId("session", state.sessions),
              plannedDate,
              actualDate: String(body.actualDate || plannedDate),
              status: body.status || (body.mode === "quick" ? "completed" : "in-progress"),
              quickCompleted: body.mode === "quick",
              rescheduled: Boolean(body.rescheduled),
              notes: String(body.notes || ""),
              exerciseStates: body.exerciseStates || {},
              clientRequestId: body.clientRequestId || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            state.sessions.push(session);
            return session;
          }, expectedVersion(body, request));
          return json({ session: result.result, version: result.version }, 201);
        }

        const sessionMatch = path.match(/^sessions\/([^/]+)$/);
        if (sessionMatch && method === "PUT") {
          const result = await store.update((state) => {
            const session = findById(state.sessions, sessionMatch[1]);
            if (!session) throw new Error("训练会话不存在");
            for (const key of ["plannedDate", "actualDate", "status", "notes", "exerciseStates", "rescheduled"]) if (body[key] !== undefined) session[key] = body[key];
            session.quickCompleted = body.quickCompleted ?? session.quickCompleted;
            session.updatedAt = new Date().toISOString();
            return session;
          }, expectedVersion(body, request));
          return json({ session: result.result, version: result.version });
        }

        if (path === "records" && method === "POST") {
          const result = await store.update((state) => {
            const session = findById(state.sessions, body.sessionId);
            if (!session) throw new Error("训练会话不存在");
            const duplicate = body.clientRequestId && state.records.find((item) => item.clientRequestId === body.clientRequestId);
            if (duplicate) return duplicate;
            const plannedExercise = findById(state.exercises, body.exerciseId);
            const actualExercise = findById(state.exercises, body.actualExerciseId || body.exerciseId);
            const record = {
              id: nextId("record", state.records),
              sessionId: body.sessionId,
              exerciseId: actualExercise?.id || body.exerciseId,
              plannedExerciseId: plannedExercise?.id || body.exerciseId,
              exerciseName: actualExercise?.name || String(body.exerciseName || "有氧"),
              actualDate: body.actualDate || body.date || getToday(state.settings.timezone),
              setNumber: Number(body.setNumber || 1),
              weight: body.weight === "" || body.weight === undefined ? null : Number(body.weight),
              unit: body.unit || state.settings.defaultUnit,
              reps: body.reps === "" || body.reps === undefined ? null : Number(body.reps),
              duration: body.duration === "" || body.duration === undefined ? null : Number(body.duration),
              distance: body.distance === "" || body.distance === undefined ? null : Number(body.distance),
              quantity: body.quantity === "" || body.quantity === undefined ? null : Number(body.quantity),
              assistance: body.assistance === "" || body.assistance === undefined ? null : Number(body.assistance),
              notes: String(body.notes || ""),
              clientRequestId: body.clientRequestId || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            state.records.push(record);
            if (!session.quickCompleted) {
              session.exerciseStates = { ...session.exerciseStates, [body.exerciseId]: "completed" };
              const occurrence = getOccurrence(state, session.plannedDate);
              const required = occurrence.blockId ? state.exercises.filter((exercise) => exercise.blockId === occurrence.blockId && !exercise.archived) : [];
              const completed = required.length > 0 && required.every((exercise) => session.exerciseStates[exercise.id] === "completed");
              session.status = completed ? "completed" : "partial";
            }
            session.updatedAt = new Date().toISOString();
            return record;
          }, expectedVersion(body, request));
          return json({ record: result.result, version: result.version }, 201);
        }
        const recordMatch = path.match(/^records\/([^/]+)$/);
        if (recordMatch && method === "PUT") {
          const result = await store.update((state) => {
            const record = findById(state.records, recordMatch[1]);
            if (!record) throw new Error("训练记录不存在");
            for (const key of ["weight", "unit", "reps", "duration", "distance", "quantity", "assistance", "notes", "setNumber"]) if (body[key] !== undefined) record[key] = body[key];
            record.updatedAt = new Date().toISOString();
            recalculateSession(state, findById(state.sessions, record.sessionId));
            return record;
          }, expectedVersion(body, request));
          return json({ record: result.result, version: result.version });
        }
        if (recordMatch && method === "DELETE") {
          const result = await store.update((state) => {
            const record = findById(state.records, recordMatch[1]);
            if (!record) throw new Error("训练记录不存在");
            state.records = state.records.filter((record) => record.id !== recordMatch[1]);
            recalculateSession(state, findById(state.sessions, record.sessionId));
          }, expectedVersion(body, request));
          return json({ ok: true, version: result.version });
        }

        if (path === "goals" && method === "POST") {
          const result = await store.update((state) => {
            const goal = { id: nextId("goal", state.goals), text: String(body.text || ""), deadline: String(body.deadline || ""), notes: String(body.notes || ""), achieved: Boolean(body.achieved) };
            if (!goal.text) throw new Error("目标内容不能为空");
            state.goals.push(goal);
            return goal;
          }, expectedVersion(body, request));
          return json({ goal: result.result, version: result.version }, 201);
        }
        const goalMatch = path.match(/^goals\/([^/]+)$/);
        if (goalMatch && method === "PUT") {
          const result = await store.update((state) => {
            const goal = findById(state.goals, goalMatch[1]);
            if (!goal) throw new Error("目标不存在");
            for (const key of ["text", "deadline", "notes", "achieved"]) if (body[key] !== undefined) goal[key] = body[key];
            return goal;
          }, expectedVersion(body, request));
          return json({ goal: result.result, version: result.version });
        }

        if (path === "history" && method === "GET") {
          const history = collectHistory(current.state, url.searchParams.get("from"), url.searchParams.get("to"), url.searchParams.get("exercise"));
          return json({ ...history, version: current.version });
        }

        if (path === "export" && method === "GET") {
          const result = await store.update((state) => {
            state.backup = { lastExportAt: new Date().toISOString() };
          }, current.version);
          return json({ exportedAt: result.state.backup.lastExportAt, version: result.version, state: result.state });
        }

        if (path === "import" && method === "POST") {
          const incoming = body.state ?? body;
          validateState(incoming);
          if (body.replace && body.confirm !== "REPLACE") return json({ error: "覆盖导入需要输入 REPLACE 确认" }, 400);
          const result = await store.update((state) => body.replace ? Object.assign(state, { ...incoming, access: state.access }) : Object.assign(state, mergeStates(state, incoming)), current.version);
          return json(clientData(result.state, result.version));
        }

        if (path === "reset" && method === "POST") {
          if (body.confirm !== "RESET") return json({ error: "请输入 RESET 确认清空" }, 400);
          if (!current.state.backup?.lastExportAt) return json({ error: "请先导出当前数据备份，再清空" }, 400);
          if (String(body.backupVersion) !== String(current.version)) return json({ error: "请先导出当前版本备份，再清空数据" }, 400);
          const result = await store.update((state) => {
            const access = state.access;
            Object.assign(state, createEmptyState(), { access: { ...access, authVersion: (access?.authVersion ?? 1) + 1 } });
          }, current.version);
          return json(clientData(result.state, result.version));
        }

        return json({ error: "接口不存在" }, 404);
      } catch (error) {
        if (error instanceof ConflictError) return json({ error: error.message, code: "conflict" }, 409);
        return json({ error: error instanceof Error ? error.message : "服务器错误" }, error.status || 500);
      }
    },
  };
}

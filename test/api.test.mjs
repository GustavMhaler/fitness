import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../functions/lib/api.mjs";
import { MemoryStore } from "../functions/lib/store.mjs";

async function request(api, path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  const response = await api.fetch(new Request(`https://fitness.test/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }));
  return {
    response,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function authenticatedApi() {
  const api = createApi({ ACCESS_PASSPHRASE: "correct-horse", store: new MemoryStore() });
  const auth = await request(api, "auth", { method: "POST", body: { passcode: "correct-horse" } });
  assert.equal(auth.response.status, 200);
  return { api, cookie: auth.cookie };
}

test("the access gate protects bootstrap and remembers an authenticated device", async () => {
  const api = createApi({ ACCESS_PASSPHRASE: "correct-horse", store: new MemoryStore() });
  const denied = await request(api, "bootstrap");
  assert.equal(denied.response.status, 401);

  const auth = await request(api, "auth", { method: "POST", body: { passcode: "correct-horse" } });
  assert.equal(auth.response.status, 200);
  const bootstrap = await request(api, "bootstrap", { cookie: auth.cookie });
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.data.initialized, false);
  assert.match(auth.cookie, /^fitness_session=/);
});

test("a user can initialize a seed plan and complete the current workout without fake measurements", async () => {
  const { api, cookie } = await authenticatedApi();
  const initialized = await request(api, "initialize", { method: "POST", cookie, body: { mode: "seed" } });
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.data.initialized, true);
  assert.equal(initialized.data.blocks.length, 4);
  assert.equal(initialized.data.blocks.find((block) => block.id === "block-cardio")?.category, "cardio");
  assert.equal(initialized.data.weeklyPlan[1].blockId, "block-cardio");

  const quick = await request(api, "sessions", {
    method: "POST",
    cookie,
    body: { plannedDate: "2026-08-20", mode: "quick", clientRequestId: "tap-1" },
  });
  assert.equal(quick.response.status, 201);
  assert.equal(quick.data.session.status, "completed");
  assert.equal(quick.data.session.quickCompleted, true);

  const duplicate = await request(api, "sessions", {
    method: "POST",
    cookie,
    body: { plannedDate: "2026-08-20", mode: "quick", clientRequestId: "tap-1" },
  });
  assert.equal(duplicate.data.session.id, quick.data.session.id);
});

test("a cardio block offers selectable actions and one action completes the cardio day", async () => {
  const { api, cookie } = await authenticatedApi();
  const initialized = await request(api, "initialize", { method: "POST", cookie, body: { mode: "seed" } });
  const cardio = initialized.data.exercises.find((exercise) => exercise.blockId === "block-cardio");
  assert.ok(cardio);

  const session = await request(api, "sessions", {
    method: "POST",
    cookie,
    body: { plannedDate: "2026-08-17", mode: "detail" },
  });
  const record = await request(api, "records", {
    method: "POST",
    cookie,
    body: {
      sessionId: session.data.session.id,
      exerciseId: cardio.id,
      actualExerciseId: cardio.id,
      actualDate: "2026-08-17",
      duration: 20,
      clientRequestId: "cardio-record-1",
    },
  });

  assert.equal(record.response.status, 201);
  assert.equal(record.data.record.exerciseId, cardio.id);
  const bootstrap = await request(api, "bootstrap?date=2026-08-17", { cookie });
  assert.equal(bootstrap.data.sessions[0].status, "completed");
});

test("stale plan edits return a conflict instead of silently overwriting a newer device", async () => {
  const { api, cookie } = await authenticatedApi();
  const initialized = await request(api, "initialize", { method: "POST", cookie, body: { mode: "blank" } });
  const first = await request(api, "settings", {
    method: "PUT",
    cookie,
    body: { expectedVersion: initialized.data.version, settings: { defaultUnit: "lb" } },
  });
  assert.equal(first.response.status, 200);
  const stale = await request(api, "settings", {
    method: "PUT",
    cookie,
    body: { expectedVersion: initialized.data.version, settings: { defaultUnit: "kg" } },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.code, "conflict");
});

test("rest days cannot create sessions and the configured week starts on Monday", async () => {
  const { api, cookie } = await authenticatedApi();
  await request(api, "initialize", { method: "POST", cookie, body: { mode: "seed" } });
  const rest = await request(api, "sessions", { method: "POST", cookie, body: { plannedDate: "2026-08-19", mode: "quick" } });
  assert.equal(rest.response.status, 400);
  const bootstrap = await request(api, "bootstrap?date=2026-08-20", { cookie });
  assert.equal(bootstrap.data.weekStart, "2026-08-17");
  assert.equal(bootstrap.data.occurrences[0].plannedDate, "2026-08-17");
});

test("passcode rotation invalidates the old passcode and record retries are idempotent", async () => {
  const { api, cookie } = await authenticatedApi();
  await request(api, "initialize", { method: "POST", cookie, body: { mode: "seed" } });
  const changed = await request(api, "auth/change", { method: "POST", cookie, body: { currentPasscode: "correct-horse", newPasscode: "new-correct-horse" } });
  assert.equal(changed.response.status, 200);

  const oldAuth = await request(api, "auth", { method: "POST", body: { passcode: "correct-horse" } });
  assert.equal(oldAuth.response.status, 401);
  const newAuth = await request(api, "auth", { method: "POST", body: { passcode: "new-correct-horse" } });
  assert.equal(newAuth.response.status, 200);

  const session = await request(api, "sessions", { method: "POST", cookie: newAuth.cookie, body: { plannedDate: "2026-08-20", mode: "detail" } });
  const recordBody = { sessionId: session.data.session.id, exerciseId: "exercise-1", actualDate: "2026-08-20", reps: 5, clientRequestId: "record-retry-1" };
  const record = await request(api, "records", { method: "POST", cookie: newAuth.cookie, body: recordBody });
  const retry = await request(api, "records", { method: "POST", cookie: newAuth.cookie, body: recordBody });
  assert.equal(record.data.record.id, retry.data.record.id);
});

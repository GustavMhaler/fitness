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
  assert.equal(initialized.data.blocks.length, 3);

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

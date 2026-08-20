import { createEmptyState } from "./state.mjs";

const STATE_ID = 1;

export class ConflictError extends Error {
  constructor(message = "数据已在其他设备更新，请刷新后重试") {
    super(message);
    this.name = "ConflictError";
    this.status = 409;
  }
}

export class MemoryStore {
  constructor(state = createEmptyState()) {
    this.state = structuredClone(state);
    this.version = 1;
  }

  async read() {
    return { state: structuredClone(this.state), version: this.version };
  }

  async update(mutator, expectedVersion) {
    if (expectedVersion !== undefined && expectedVersion !== this.version) {
      throw new ConflictError();
    }
    const draft = structuredClone(this.state);
    const result = await mutator(draft);
    this.state = draft;
    this.version += 1;
    return { state: structuredClone(this.state), version: this.version, result };
  }
}

export class D1Store {
  constructor(db) {
    this.db = db;
  }

  async read() {
    await this.ensureRow();
    const row = await this.db
      .prepare("SELECT version, state_json FROM app_state WHERE id = ?")
      .bind(STATE_ID)
      .first();
    return { state: JSON.parse(row.state_json), version: row.version };
  }

  async update(mutator, expectedVersion) {
    const current = await this.read();
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(current.version)) {
      throw new ConflictError();
    }

    const draft = structuredClone(current.state);
    const result = await mutator(draft);
    const nextVersion = Number(current.version) + 1;
    const update = await this.db
      .prepare("UPDATE app_state SET version = ?, state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ?")
      .bind(nextVersion, JSON.stringify(draft), STATE_ID, current.version)
      .run();

    if (!update.success || update.meta?.changes !== 1) {
      throw new ConflictError();
    }

    return { state: draft, version: nextVersion, result };
  }

  async ensureRow() {
    await this.db
      .prepare("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, state_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
      .run();
    await this.db
      .prepare("INSERT OR IGNORE INTO app_state (id, version, state_json) VALUES (?, 1, ?)")
      .bind(STATE_ID, JSON.stringify(createEmptyState()))
      .run();
  }
}

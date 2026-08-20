# 11 — Multi-device consistency and reliable mutation

**What to build:** A user can safely use the app from multiple devices: records are shared, retries are idempotent, and stale edits produce visible conflicts instead of silently overwriting newer data.

**Blocked by:** 04 — Edit future weekly plans; 05 — Quick workout completion; 06 — Detailed set-level training records; 07 — Partial completion, rescheduling, and substitutions; 08 — Goal management; 10 — Backup, restore, and safe reset.

**Status:** ready-for-agent

- [ ] Two authenticated clients see the same committed plan, session, record, goal, and backup state.
- [ ] Retried mutations do not create duplicate sessions, records, goals, or plan edits.
- [ ] Stale concurrent edits are detected and presented as recoverable conflicts.
- [ ] Network failures expose a safe retry path without losing entered data.
- [ ] Multi-device behavior is covered through the browser → API → D1 seam.

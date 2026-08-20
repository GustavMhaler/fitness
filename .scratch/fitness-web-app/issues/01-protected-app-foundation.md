# 01 — Protected app foundation and test seam

**What to build:** A user can open the app, enter an access passcode, stay authenticated for 30 days on the current browser/device, and use an authenticated app shell backed by D1. The browser-to-API-to-D1 seam has a runnable end-to-end test harness.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Valid passcodes grant access and invalid or missing credentials cannot read or write protected data.
- [ ] Remembered access expires after 30 days and passcode rotation invalidates prior credentials.
- [ ] D1 connectivity and API failure states are visible to the user.
- [ ] The confirmed browser → API → D1 seam has a repeatable test fixture.

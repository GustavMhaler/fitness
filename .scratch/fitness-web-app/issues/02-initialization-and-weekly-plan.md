# 02 — First-run initialization and weekly plan display

**What to build:** A user can choose an example plan or a blank plan and see the current weekly plan with the current training day highlighted, including training blocks, cardio days, and rest days. Date instances follow the configured time zone and week-start day.

**Blocked by:** 01 — Protected app foundation and test seam.

**Status:** ready-for-agent

- [ ] First run offers example-plan and blank-plan setup without overwriting existing data.
- [ ] The weekly plan displays seven dated plan occurrences and highlights today.
- [ ] Training blocks, cardio days, and rest days are visibly distinct.
- [ ] Time zone, week-start day, default unit, and default rest duration can be configured.
- [ ] Repeating initialization is idempotent.

# Fitness Manager Web App

Status: ready-for-agent

## Problem Statement

作为单人居家健身者，我需要一个跨设备可用的训练计划和打卡工具，但当前的计划、实际训练、历史进度和目标没有一个可靠的闭环：计划只能被展示，打卡容易丢失，计划调整会影响历史理解，动作替代和不同类型的训练也难以记录。

应用部署在 Cloudflare 上，数据需要持久化到 D1。虽然只有一个用户，但公开部署的地址仍然暴露个人训练数据和写操作，因此不能默认开放访问。

## Solution

构建一个中文、深色主题优先、响应式的单页健身 Web 应用。应用以一个可重复的 weekly plan 为基础，为每个日期生成 plan occurrence；用户在具体日期上创建 workout session，可以快速完成，也可以记录到每组的实际表现。

应用提供以下闭环：

- 访问口令保护数据，当前浏览器成功验证后记住 30 天；不同设备分别验证，但共享同一份 D1 数据。
- 展示 weekly plan、training day、training block、exercise library，以及当天高亮。
- 支持 rest day、cardio day、力量训练和计划外动作。
- 支持快速完成、详细打卡、部分完成、跳过、调休和补打卡。
- 以 adherence 区分计划执行情况，以训练记录和 set 数据展示实际表现趋势。
- 允许未来计划编辑、动作替代、自定义动作、归档、目标管理、备份和恢复。
- 首版在线优先；提醒、身体指标、training feedback、多周期轮换和离线写入放入后续阶段。

## User Stories

1. As a single-user fitness enthusiast, I want to protect the app with an access passcode, so that my personal training data is not publicly readable or writable.
2. As a user, I want successful access to be remembered for 30 days on the current browser or device, so that I do not have to enter the passcode on every visit.
3. As a user, I want to change the access passcode while authenticated, so that I can rotate it when needed.
4. As a user, I want a deployment-level recovery path when I forget the passcode, so that I cannot permanently lock myself out of a single-user app.
5. As a user, I want the API to reject unauthenticated reads and writes, so that hiding the passcode screen does not provide false security.
6. As a user, I want to see my weekly plan across seven days, so that I know how the week is intended to flow.
7. As a user, I want the current training day highlighted, so that I can start the right activity quickly.
8. As a user, I want to see each planned workout's type as a training block, cardio, or rest, so that I understand what is expected without opening multiple screens.
9. As a user, I want to inspect a training block's exercises, prescriptions, target parts, sets, repetitions, time targets, and notes, so that I can perform it without consulting another document.
10. As a user, I want the weekly plan to generate dated plan occurrences, so that the app distinguishes a reusable plan from what was planned on a specific date.
11. As a user, I want to configure my time zone and week start day, so that “today” and weekly summaries match my real life across devices.
12. As a user, I want plan changes to affect future occurrences only, so that editing next week’s plan does not rewrite what happened last week.
13. As a user, I want to duplicate a training block, so that I can create a similar workout without entering every exercise again.
14. As a user, I want to duplicate a weekly plan, so that I can prepare a future plan efficiently.
15. As a user, I want to preview future plan occurrences, so that I can catch scheduling mistakes before the training date arrives.
16. As a user, I want to clear or replace future plan occurrences with confirmation, so that I can change plans without touching historical data.
17. As a user, I want plan edits to save immediately, so that I do not lose changes when navigating away.
18. As a user, I want to see saving and error states, so that I know whether an edit reached the server.
19. As a user, I want to undo my most recent plan edit, so that an accidental deletion or change is recoverable.
20. As a user, I want to add, edit, reorder, and archive exercises in the exercise library, so that the app reflects the equipment I actually have.
21. As a user, I want archived exercises to remain visible in historical records, so that old trend data does not break when an exercise is no longer used.
22. As a user, I want to create custom exercises with target part, prescription, and notes, so that I am not limited to the seed data.
23. As a user, I want to choose an exercise substitution during a workout, so that an unavailable movement does not prevent me from recording the session.
24. As a user, I want a substitution to retain its relationship to the planned exercise, so that the app can count adherence without pretending the two exercises have identical performance.
25. As a user, I want to start a workout session from a training day, so that my actual activity is connected to the plan occurrence.
26. As a user, I want to mark a planned workout as quickly completed without entering measurements, so that I can record attendance when I am short on time.
27. As a user, I want quick completion to avoid inventing weights, repetitions, or durations, so that performance charts remain trustworthy.
28. As a user, I want to add detailed training records for an exercise, so that I can record what I actually did rather than only whether I attended.
29. As a user, I want to record each set separately, so that different weights, repetitions, durations, or effort levels within one exercise are preserved.
30. As a user, I want to record weight, unit, repetitions, duration, distance, quantity, bodyweight, assistance, and notes when applicable, so that strength, timed, cardio, and bodyweight exercises all fit the same workflow.
31. As a user, I want actual values to differ from the plan prescription, so that I can record a safe or realistic session without being blocked by a target such as “15-20”, “力竭”, or “30秒”.
32. As a user, I want to record a workout session as in progress, completed, partially completed, or skipped, so that the history reflects what really happened.
33. As a user, I want exercise-level completion states, so that completing only some required exercises is distinguishable from completing the entire workout.
34. As a user, I want the app to derive completed and partial states from exercise completion while allowing explicit skip decisions, so that common cases are quick but edge cases remain precise.
35. As a user, I want to record that a training day was completed on a different date, so that rescheduled and make-up training preserve both the planned date and the actual date.
36. As a user, I want rest days to require no completion action and not count as missed workouts, so that recovery is represented correctly.
37. As a user, I want cardio days to support duration and distance, so that cardio is not forced into a strength-training sets model.
38. As a user, I want to edit an incorrect training record, so that a typo does not permanently distort my history.
39. As a user, I want to delete an incorrect training record with confirmation, so that I can remove accidental data without cascading into unrelated history.
40. As a user, I want repeated clicks and network retries to be idempotent, so that one action cannot create duplicate sessions or records.
41. As a user, I want concurrent edits to detect stale versions, so that one device does not silently overwrite a newer change made on another device.
42. As a user, I want to see my recent training records, so that I can quickly review what I did most recently.
43. As a user, I want to filter history by exercise, date range, and training type, so that I can find a relevant workout without scanning everything.
44. As a user, I want to see adherence separately from performance, so that planned completion and strength or cardio improvement are not conflated.
45. As a user, I want to see completed, partial, skipped, rescheduled, and planned counts, so that weekly execution is understandable.
46. As a user, I want to see training frequency and completed training days, so that I can understand consistency over time.
47. As a user, I want to see trend charts per actual exercise, so that substituted exercises do not create false combined performance lines.
48. As a user, I want a planned exercise substitution to count toward the planned workout’s adherence, so that adapting to equipment still reflects successful training.
49. As a user, I want trend data to omit quick-completion records that have no measurements, so that charts show observed performance only.
50. As a user, I want to create a goal with text, deadline, and completion state, so that I can track a meaningful outcome without building a full metrics system first.
51. As a user, I want to mark a goal as achieved, so that completed goals remain visible as part of my history.
52. As a user, I want the goal model to leave room for target value, current value, unit, and goal type, so that structured goals can be added without invalidating existing text goals.
53. As a user, I want to export all app data as JSON, so that I can keep a complete backup or migrate later.
54. As a user, I want to export training history as CSV, so that I can analyze it in a spreadsheet.
55. As a user, I want to preview and validate a JSON import before changing data, so that a malformed backup cannot corrupt the app.
56. As a user, I want backup import to merge by default and require explicit confirmation for replacement, so that restoring data does not unexpectedly erase current records.
57. As a user, I want a destructive full reset to require a recent backup and confirmation, so that a mistaken reset is less likely to destroy my history.
58. As a user, I want the first-run experience to offer a seed plan, a backup import, or a blank plan, so that I can choose how to begin.
59. As a user, I want existing data to prevent automatic seed overwrite, so that reopening or redeploying the app cannot erase my plan.
60. As a user, I want to set a default weight unit and rest duration, so that new records require less repetitive input.
61. As a user, I want the app to remain usable on a mobile screen, so that I can record sets while training.
62. As a user, I want network failures to show a clear retryable error, so that I know whether I need to submit a record again.
63. As a user, I want a later reminder feature to use local notifications with configurable time, quiet hours, and skip controls, so that reminders are useful rather than disruptive.
64. As a user, I want a later body-metric feature to track dated body weight or similar measurements separately from exercise weight, so that longer-term changes can be observed.
65. As a user, I want a later training-feedback feature to record optional perceived effort, fatigue, discomfort, and notes, so that performance trends have useful context without medical claims.
66. As a user, I want a later multi-cycle feature to rotate plans, so that the initial release can stay focused while supporting future progression.
67. As a user, I want a later offline feature to queue check-ins safely, so that poor gym connectivity does not lose data once conflict and duplicate handling are well defined.

## Implementation Decisions

- The application is a Chinese, dark-theme-first, responsive single-page application deployed to Cloudflare Pages. Pages Functions provide the API and D1 provides cloud persistence.
- The application remains single-user and does not introduce a full account system in this spec. A shared access passcode protects every API read and write. A successful browser/device receives a 30-day access credential; the passcode itself must not be stored in the browser. Passcode rotation invalidates prior credentials, and recovery is performed through deployment configuration or an equivalent administrator operation.
- The primary application seam is the complete user flow from browser UI through the API to a test D1 binding. API responses must use JSON; failures must return an error message and an appropriate HTTP status.
- The domain model distinguishes weekly plan, training block, planned workout, plan occurrence, training day, exercise, workout session, set, training record, adherence, quick completion, exercise substitution, exercise library, archived exercise, goal, body metric, and training feedback according to `CONTEXT.md`.
- A weekly plan is reusable, but the application materializes dated plan occurrences using the user’s configured time zone and week-start preference. The first release supports one active weekly plan and a future effective date; multiple rotating cycles are out of scope.
- A plan occurrence can represent a training block, cardio day, or rest day. Rest days need no completion record. Cardio days use duration, distance, or other suitable measures rather than requiring strength-training sets.
- Editing the active weekly plan affects future plan occurrences only. Historical planned workouts, sessions, substitutions, and training records remain stable. Historical corrections happen explicitly on the record.
- A workout session belongs to a training day but retains both planned date and actual date when a session is rescheduled or used as make-up training. Session state supports in-progress, completed, partial, and skipped; exercise-level state supports the derivation of the session state.
- Quick completion creates a completion summary without measured performance values. Detailed logging creates set-level training records. The system must not treat planned prescriptions as actual performance.
- Training measurements are flexible enough for weight and unit, repetitions, duration, distance, quantity, bodyweight, assistance, and notes. Plan prescriptions may be ranges or qualitative values and do not block actual values that differ from the prescription.
- Exercises use stable identity relationships in training records. Renaming or moving an exercise must not break history. Exercises and training blocks are archived rather than hard-deleted by default, and historical records retain enough display information to remain understandable.
- A substitution stores both the actual exercise and the planned exercise relationship. Adherence is attributed to the planned exercise or workout; performance trends are attributed to the actual exercise and must not silently merge unlike movements.
- The API should expose resources for access/session state, exercises and exercise library, training blocks, weekly plans and dated plan occurrences, workout sessions, detailed training records, goals, settings, and backup import/export. Existing PRD operations for blocks, exercises, schedule, logs, and goals should be evolved rather than duplicated.
- Mutating API operations must support idempotency for user actions that can be retried. Records should carry a server-maintained update version or timestamp so stale concurrent updates are detected rather than silently overwriting newer data.
- Plan editing provides immediate save, visible save/error state, duplication of blocks and weekly plans, preview of future occurrences, safe clearing of future plans, and at least one-step undo. Destructive actions require confirmation.
- Adherence statistics distinguish planned, completed, partial, skipped, rescheduled, and rest outcomes. Performance charts use measured records only, are grouped by actual exercise, and do not treat quick completion as a measured result.
- Goals in the first release support text, deadline, achieved state, and optional notes. The data model reserves room for goal type, target value, current value, and unit without requiring the full metric system now.
- Backup export produces a complete JSON representation and a CSV representation of training history. Import validates and previews data, merges by default, and requires explicit confirmation for replacement or full reset.
- First-run initialization must be idempotent: the user chooses seed, import, or blank setup, and existing user data is never overwritten automatically.
- Settings include time zone, week-start day, default weight unit, default rest duration, and a future reminder time. The app is online-first in the first release; offline write queues are not included.
- Reminders, body metrics, training feedback, rotating multi-cycle plans, and offline write synchronization are P2 follow-ups. Local reminder failure must have an in-app fallback when that feature is implemented.

## Testing Decisions

- Tests should assert externally observable behavior through the confirmed high-level seam: browser user action, Pages Functions API, and an isolated test D1 database. Tests should not couple to internal component structure, SQL helper names, or implementation-specific state management.
- There is no existing test framework or test prior art in the repository. The implementation should establish the smallest suitable browser/API integration harness and a disposable D1 fixture for this feature.
- Authentication flows must cover first access, valid and invalid passcodes, 30-day remembered access, expiry, passcode change, invalidation of prior credentials, and unauthenticated API access.
- Plan flows must cover seed/blank/import initialization, weekly plan rendering, today highlighting, time-zone and week-start behavior, future occurrence generation, rest/cardio days, block duplication, future-only edits, undo, and protection of historical occurrences.
- Training flows must cover quick completion, detailed set entry, different units and measurement types, in-progress/complete/partial/skipped states, explicit skip, rescheduling, make-up training, rest-day neutrality, cardio records, exercise substitution, edit/delete correction, and idempotent retry behavior.
- Multi-device behavior must be represented by separate authenticated clients sharing the same test D1 data. Tests should prove that one client can see the other client’s committed records and that stale plan edits receive a visible conflict rather than silently overwriting data.
- Exercise-library tests must cover custom exercise creation, stable identity after rename or move, archive behavior, preservation of historical display, and substitution relationships.
- History tests must cover adherence counts, planned versus actual dates, completion categories, measured-only performance trends, actual-exercise grouping, and exclusion of quick-completion records from measured charts.
- Goal and backup tests must cover deadlines and achieved state, JSON round trips, CSV export, malformed import rejection, preview-before-write, merge-by-default, explicit replacement confirmation, and full-reset safeguards.
- Mobile acceptance tests should validate touch-sized controls, quick set entry, readable charts/cards, visible network errors, and no loss of input when a request fails.

## Out of Scope

- Multiple user accounts, registration, social login, coach access, sharing, or role-based permissions.
- Email, SMS, or server-side push notifications.
- A native iOS or Android application.
- Offline write queues, background synchronization, or conflict-free replicated data structures.
- Automatic multi-cycle plan rotation or advanced periodization.
- A full medical, rehabilitation, diagnosis, or injury-treatment workflow.
- Mandatory health metrics, medical recommendations, or automated safety judgments.
- Full structured goal tracking with automatic progress calculations.
- Automatic exercise-equivalence calculations between substituted movements.
- Retroactively rewriting historical plan occurrences when the current plan changes.
- Hard deletion of historical training data through ordinary exercise or block deletion.

## Further Notes

- The current seed data describes training blocks A/B/C and a seven-day plan. It should remain usable as the example-plan option, but initialization must be safe to repeat and must not overwrite user data.
- The existing PRD’s `workout_log` shape is not sufficient for set-level records, dated plan occurrences, substitutions, idempotency, or historical stability. The database model should evolve before implementing the UI so these behaviors are first-class rather than encoded in free-text fields.
- The app should keep domain language consistent with `CONTEXT.md`: use “weekly plan” for the reusable plan, “training day” for a dated occurrence, “workout session” for an actual attempt, and “training record” for observed results.
- The relevant architectural decisions are recorded in the repository ADRs for the 30-day access gate, dated plan occurrences, and stable historical training facts.
- This spec is ready for implementation and has been published to the local Markdown issue tracker with the `ready-for-agent` status.

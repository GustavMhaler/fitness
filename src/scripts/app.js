import { animate } from "motion/mini";

const app = {
  data: null,
  activeDate: null,
  view: "plan",
  previousPlan: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(parsed);
}

function addDays(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function showToast(message, kind = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function setSync(status = "已同步") {
  $("#sync-status").innerHTML = `<span class="pulse-dot"></span> ${escapeHtml(status)}`;
}

async function request(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showAuth();
    const error = new Error(data.error || "请求失败");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function showAuth() {
  $("#auth-view").classList.remove("hidden");
  $("#app-view").classList.add("hidden");
}

function showApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  animate("#app-view", { opacity: [0, 1], transform: ["translateY(8px)", "translateY(0)"] }, { duration: 0.35 });
}

async function loadBootstrap(date = app.activeDate) {
  setSync("同步中");
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  app.data = await request(`bootstrap${query}`);
  app.activeDate = app.activeDate || app.data.today;
  showApp();
  render();
  setSync("已同步");
}

function statusLabel(status) {
  return { completed: "已完成", partial: "部分完成", skipped: "已跳过", "in-progress": "进行中", planned: "待训练", rest: "休息" }[status] || status;
}

function statusClass(status) {
  return `status-pill status-${status === "in-progress" ? "planned" : status}`;
}

function blockFor(id) {
  return app.data.blocks.find((block) => block.id === id);
}

function exercisesFor(blockId) {
  return app.data.exercises.filter((exercise) => exercise.blockId === blockId && !exercise.archived).sort((a, b) => a.sortOrder - b.sortOrder);
}

function sessionFor(date) {
  return app.data.sessions.find((session) => session.plannedDate === date);
}

function render() {
  if (!app.data?.initialized) {
    $("#onboarding-view").classList.remove("hidden");
    $("#workspace").classList.add("hidden");
    return;
  }
  $("#onboarding-view").classList.add("hidden");
  $("#workspace").classList.remove("hidden");
  $("#date-label").textContent = `${formatDate(app.activeDate || app.data.today).toUpperCase()}`;
  renderPlan();
  renderGoals();
  renderSettings();
  renderHistoryFilters();
  if (app.view === "history") refreshHistory();
}

function renderPlan() {
  const occurrences = app.data.occurrences.slice(0, 7);
  $("#plan-grid").innerHTML = occurrences.map((occurrence, index) => {
    const block = blockFor(occurrence.blockId);
    const isToday = occurrence.plannedDate === app.activeDate;
    const label = occurrence.kind === "block" ? block?.name || "训练块" : occurrence.kind === "cardio" ? "有氧" : "休息";
    return `<button class="day-card ${isToday ? "is-today" : ""} ${occurrence.kind === "rest" ? "is-rest" : ""}" data-day="${occurrence.plannedDate}">
      <div class="flex items-center justify-between"><span class="text-xs font-semibold text-slate-500">DAY ${index + 1}</span>${occurrence.status !== "planned" && occurrence.status !== "rest" ? `<span class="${statusClass(occurrence.status)}">${statusLabel(occurrence.status)}</span>` : ""}</div>
      <p class="mt-5 text-sm font-semibold text-white">${escapeHtml(label)}</p>
      <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">${escapeHtml(occurrence.kind === "cardio" ? occurrence.cardioDesc || "自由有氧" : occurrence.kind === "rest" ? "恢复也是训练的一部分" : block?.description || "按计划完成" )}</p>
    </button>`;
  }).join("");
  renderToday();
}

function renderToday() {
  const occurrence = app.data.occurrences.find((item) => item.plannedDate === app.activeDate) || app.data.occurrences[0];
  if (!occurrence) return;
  app.activeDate = occurrence.plannedDate;
  const block = blockFor(occurrence.blockId);
  const session = sessionFor(occurrence.plannedDate);
  const exerciseList = block ? exercisesFor(block.id) : [];
  const stateText = session ? statusLabel(session.status) : occurrence.kind === "rest" ? "恢复日" : "准备开始";
  let detail = "";
  if (occurrence.kind === "rest") {
    detail = `<div class="mt-7 rounded-xl border border-white/5 bg-white/[0.025] p-5"><p class="text-sm font-semibold text-white">今天不需要打卡</p><p class="mt-2 text-sm leading-6 text-slate-400">可以散步、拉伸，或者真正休息。休息日不会算作漏训。</p></div>`;
  } else if (occurrence.kind === "cardio") {
    detail = `<div class="mt-7 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] p-5"><p class="text-sm font-semibold text-white">${escapeHtml(occurrence.cardioDesc || "自由有氧")}</p><p class="mt-2 text-sm text-slate-400">可用详细记录填写时长、距离和备注。</p><div class="mt-4 flex flex-wrap items-end gap-2"><form class="cardio-form flex flex-wrap items-end gap-2" data-date="${occurrence.plannedDate}"><label class="field-label">分钟<input name="duration" class="compact-input mt-1" inputmode="numeric" placeholder="时长" /></label><label class="field-label">公里<input name="distance" class="compact-input mt-1" inputmode="decimal" placeholder="距离" /></label><button class="secondary-button" type="submit">记录有氧</button></form><button class="primary-button" data-quick="${occurrence.plannedDate}">${session?.status === "completed" ? "已完成" : "快速完成"} <span>→</span></button><button class="ghost-button" data-skip="${occurrence.plannedDate}">跳过</button><button class="ghost-button" data-reschedule="${occurrence.plannedDate}">调休</button></div></div>`;
  } else {
    detail = `<div class="mt-7 space-y-3">${exerciseList.map((exercise) => {
      const records = app.data.records.filter((record) => (record.exerciseId === exercise.id || record.plannedExerciseId === exercise.id) && record.sessionId === session?.id);
      return `<article class="exercise-row"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-sm font-semibold text-white">${escapeHtml(exercise.name)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(exercise.targetPart || "全身")} · ${escapeHtml(exercise.sets || "—")} 组 × ${escapeHtml(exercise.reps || "自定")}</p></div><span class="soft-chip">${escapeHtml(exercise.note || "按状态调整")}</span></div><div class="mt-4 flex flex-wrap items-end gap-2"><form class="record-form flex flex-wrap items-end gap-2" data-exercise-id="${exercise.id}" data-date="${occurrence.plannedDate}"><label class="field-label">实际动作<select name="actualExerciseId" class="compact-input mt-1">${exerciseList.map((candidate) => `<option value="${candidate.id}" ${candidate.id === exercise.id ? "selected" : ""}>${escapeHtml(candidate.name)}</option>`).join("")}</select></label><label class="field-label">重量<input name="weight" class="compact-input mt-1" inputmode="decimal" placeholder="kg" /></label><label class="field-label">次数<input name="reps" class="compact-input mt-1" inputmode="numeric" placeholder="次数" /></label><label class="field-label">秒数<input name="duration" class="compact-input mt-1" inputmode="numeric" placeholder="时长" /></label><button class="secondary-button" type="submit">记一组</button></form></div>${records.length ? `<p class="mt-3 text-xs text-cyan-200">已记录：${records.map((record) => [record.weight ? `${record.weight}${record.unit}` : "", record.reps ? `${record.reps} 次` : "", record.duration ? `${record.duration} 秒` : ""].filter(Boolean).join(" × ")).join(" · ")}</p>` : ""}</article>`;
    }).join("")}<div class="flex flex-wrap gap-3 pt-2"><button class="primary-button" data-quick="${occurrence.plannedDate}">${session?.status === "completed" ? "已完成训练" : "快速完成训练"} <span>→</span></button>${session ? `<button class="secondary-button" data-partial="${session.id}">标记部分完成</button>` : ""}<button class="ghost-button" data-skip="${occurrence.plannedDate}">跳过</button><button class="ghost-button" data-reschedule="${occurrence.plannedDate}">调休</button></div></div>`;
  }
  $("#today-card").innerHTML = `<div class="border-b border-white/5 p-5 sm:p-7"><div class="flex flex-wrap items-start justify-between gap-4"><div><p class="section-kicker">TODAY'S WORKOUT</p><h2 class="mt-2 text-2xl font-semibold text-white">${escapeHtml(occurrence.kind === "block" ? block?.name || "训练" : occurrence.kind === "cardio" ? "有氧日" : "恢复日")}</h2><p class="mt-2 text-sm text-slate-400">${escapeHtml(formatDate(occurrence.plannedDate))} · ${escapeHtml(occurrence.kind === "block" ? block?.description || "" : occurrence.cardioDesc || "")}</p></div><span class="${statusClass(session?.status || occurrence.status)}">${stateText}</span></div>${session?.actualDate && session.actualDate !== session.plannedDate ? `<p class="mt-4 text-xs text-amber-200">实际训练日期：${escapeHtml(formatDate(session.actualDate))}</p>` : ""}</div><div class="p-5 sm:p-7">${detail}</div>`;
  $("#date-label").textContent = formatDate(app.activeDate).toUpperCase();
}

function renderGoals() {
  $("#goal-list").innerHTML = app.data.goals.length ? app.data.goals.map((goal) => `<div class="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.025] p-4"><div class="flex min-w-0 items-center gap-3"><button class="grid h-7 w-7 shrink-0 place-items-center rounded-full border ${goal.achieved ? "border-lime-300 bg-lime-300 text-slate-950" : "border-slate-600 text-transparent"}" data-goal-toggle="${goal.id}" aria-label="标记目标">✓</button><div class="min-w-0"><p class="truncate text-sm ${goal.achieved ? "text-slate-500 line-through" : "text-white"}">${escapeHtml(goal.text)}</p>${goal.deadline ? `<p class="mt-1 text-xs text-slate-500">截止 ${escapeHtml(goal.deadline)}</p>` : ""}</div></div><div class="flex items-center gap-2"><button class="ghost-button" data-edit-goal="${goal.id}" type="button">编辑</button><span class="status-pill ${goal.achieved ? "status-completed" : "status-planned"}">${goal.achieved ? "已达成" : "进行中"}</span></div></div>`).join("") : `<div class="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">还没有目标，先写下一个具体的小目标。</div>`;
}

function renderSettings() {
  const settings = app.data.settings;
  const form = $("#settings-form");
  for (const [key, value] of Object.entries(settings)) if (form.elements[key]) form.elements[key].value = value;
  const plan = app.data.weeklyPlan;
  $("#plan-form").innerHTML = Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    const item = plan[day] || plan[String(day)] || { kind: "rest", blockId: null, cardioDesc: "" };
    return `<div class="grid gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-3 sm:grid-cols-[72px_150px_1fr]"><div class="self-center text-sm font-semibold text-slate-400">Day ${day}</div><select name="day-${day}-kind" class="field-input mt-0"><option value="block" ${item.kind === "block" ? "selected" : ""}>训练块</option><option value="cardio" ${item.kind === "cardio" ? "selected" : ""}>有氧</option><option value="rest" ${item.kind === "rest" ? "selected" : ""}>休息</option></select><div class="grid gap-2 sm:grid-cols-2"><select name="day-${day}-block" class="field-input mt-0"><option value="">选择训练块</option>${app.data.blocks.map((block) => `<option value="${block.id}" ${item.blockId === block.id ? "selected" : ""}>${escapeHtml(block.name)}</option>`).join("")}</select><input name="day-${day}-cardio" class="field-input mt-0" value="${escapeHtml(item.cardioDesc || "")}" placeholder="有氧描述或恢复建议" /></div></div>`;
  }).join("");
  $("#block-list").innerHTML = app.data.blocks.length ? app.data.blocks.map((block) => `<div class="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-3"><div class="min-w-0"><p class="truncate text-sm font-semibold text-white">${escapeHtml(block.name)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(block.description || "无说明")} · ${exercisesFor(block.id).length} 个动作</p></div><button class="ghost-button" data-duplicate-block="${block.id}" type="button">复制</button></div>`).join("") : `<div class="col-span-full rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">还没有训练块。</div>`;
  $("#exercise-block-select").innerHTML = `<option value="">不归属训练块</option>${app.data.blocks.map((block) => `<option value="${block.id}">${escapeHtml(block.name)}</option>`).join("")}`;
  $("#exercise-list").innerHTML = app.data.exercises.length ? app.data.exercises.map((exercise) => { const block = blockFor(exercise.blockId); const siblings = app.data.exercises.filter((item) => item.blockId === exercise.blockId).sort((left, right) => left.sortOrder - right.sortOrder); const index = siblings.findIndex((item) => item.id === exercise.id); return `<div class="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-3"><div class="min-w-0"><p class="truncate text-sm font-semibold text-white">${escapeHtml(exercise.name)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(block?.name || "未归类")} · ${escapeHtml(exercise.targetPart || "全身")} · ${escapeHtml(exercise.sets || "—")} × ${escapeHtml(exercise.reps || "自定")}</p></div><div class="flex shrink-0 gap-1"><button class="ghost-button" data-move-exercise="${exercise.id}" data-direction="up" ${index === 0 ? "disabled" : ""} type="button">↑</button><button class="ghost-button" data-move-exercise="${exercise.id}" data-direction="down" ${index === siblings.length - 1 ? "disabled" : ""} type="button">↓</button><button class="ghost-button" data-edit-exercise="${exercise.id}" type="button">编辑</button><button class="ghost-button text-rose-300" data-archive-exercise="${exercise.id}" type="button">归档</button></div></div>`; }).join("") : `<div class="col-span-full rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">还没有动作。</div>`;
}

function renderHistoryFilters() {
  $("#history-exercise").innerHTML = `<option value="">全部动作</option>${(app.data.allExercises || app.data.exercises).map((exercise) => `<option value="${exercise.id}">${escapeHtml(exercise.name)}</option>`).join("")}`;
}

async function refreshHistory() {
  if (!app.data?.initialized) return;
  const from = $("#history-from").value || addDays(app.data.today, -30);
  const to = $("#history-to").value || app.data.today;
  const exercise = $("#history-exercise").value;
  const kind = $("#history-kind").value;
  const history = await request(`history?from=${from}&to=${to}&exercise=${encodeURIComponent(exercise)}&kind=${encodeURIComponent(kind)}`);
  const stats = history.adherence;
  $("#history-summary").innerHTML = [["执行率", `${stats.percentage}%`, "completed / planned"], ["完成训练", stats.completed, "训练日"], ["部分完成", stats.partial, "需要调整"], ["训练频率", history.frequency, "实际训练日"]].map(([label, value, note]) => `<div class="metric-card"><p class="section-kicker">${label}</p><p class="mt-3 text-3xl font-semibold text-white">${value}</p><p class="mt-1 text-xs text-slate-500">${note}</p></div>`).join("");
  $("#history-trends").innerHTML = history.trends?.length ? history.trends.map((trend) => `<div class="rounded-xl border border-white/5 bg-white/[0.025] p-4"><div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold text-white">${escapeHtml(trend.name)}</p><span class="text-xs text-slate-500">${trend.count} 组</span></div><div class="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div class="h-full rounded-full bg-gradient-to-r from-cyan-300 to-lime-300" style="width:${Math.min(100, Math.max(8, trend.count * 12))}%"></div></div></div>`).join("") : "";
  $("#history-list").innerHTML = history.records.length ? history.records.slice().reverse().map((record) => { const exercise = (app.data.allExercises || app.data.exercises).find((item) => item.id === record.exerciseId); return `<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-4"><div><p class="text-sm font-semibold text-white">${escapeHtml(exercise?.name || record.exerciseName || "已归档动作")}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(record.actualDate)} · 第 ${record.setNumber} 组</p></div><div class="flex items-center gap-3"><p class="text-sm text-cyan-100">${escapeHtml([record.weight ? `${record.weight}${record.unit}` : "", record.reps ? `${record.reps} 次` : "", record.duration ? `${record.duration} 秒` : "", record.distance ? `${record.distance} km` : ""].filter(Boolean).join(" × ") || "仅记录完成")}</p><button class="ghost-button" data-edit-record="${record.id}" type="button">编辑</button><button class="ghost-button text-rose-300" data-delete-record="${record.id}" type="button">删除</button></div></div>`; }).join("") : `<div class="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">这个时间范围还没有详细训练记录。</div>`;
}

function switchView(view) {
  app.view = view;
  const titles = { plan: "本周计划", history: "历史进度", goals: "训练目标", settings: "设置与编辑" };
  $("#page-title").textContent = titles[view];
  $$(".view-panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== `view-${view}`));
  $$(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  if (view === "history") refreshHistory().catch((error) => showToast(error.message, "error"));
}

async function initialize(mode) {
  try { app.data = await request("initialize", { method: "POST", body: { mode } }); app.activeDate = app.data.today; render(); showToast(mode === "seed" ? "示例计划已准备好" : "空白计划已准备好"); } catch (error) { showToast(error.message, "error"); }
}

async function quickComplete(date) {
  try { await request("sessions", { method: "POST", body: { plannedDate: date, actualDate: date, mode: "quick", clientRequestId: `quick:${date}` } }); await loadBootstrap(date); showToast("训练已记录"); } catch (error) { showToast(error.message, "error"); }
}

async function skipWorkout(date) {
  try { await request("sessions", { method: "POST", body: { plannedDate: date, actualDate: date, mode: "detail", status: "skipped", clientRequestId: `skip:${date}` } }); await loadBootstrap(date); showToast("已记录跳过"); } catch (error) { showToast(error.message, "error"); }
}

async function rescheduleWorkout(date) {
  const actualDate = window.prompt("调整到哪一天？请使用 YYYY-MM-DD", date);
  if (!actualDate || actualDate === date) return;
  try { await request("sessions", { method: "POST", body: { plannedDate: date, actualDate, mode: "detail", status: "completed", rescheduled: true, clientRequestId: `reschedule:${date}:${actualDate}` } }); await loadBootstrap(date); showToast(`已调整到 ${actualDate}`); } catch (error) { showToast(error.message, "error"); }
}

async function submitRecord(form) {
  try {
    const date = form.dataset.date;
    let session = sessionFor(date);
    if (!session) { const response = await request("sessions", { method: "POST", body: { plannedDate: date, actualDate: date, mode: "detail", clientRequestId: `detail:${date}` } }); session = response.session; }
    const values = Object.fromEntries(new FormData(form).entries());
    const plannedExerciseId = form.dataset.exerciseId || "cardio";
    const actualExerciseId = values.actualExerciseId || plannedExerciseId;
    const setNumber = app.data.records.filter((record) => record.sessionId === session.id && (record.exerciseId === actualExerciseId || record.plannedExerciseId === plannedExerciseId)).length + 1;
    await request("records", { method: "POST", body: { ...values, sessionId: session.id, exerciseId: plannedExerciseId, actualExerciseId, actualDate: date, setNumber, clientRequestId: `record:${session.id}:${plannedExerciseId}:${setNumber}:${actualExerciseId}` } });
    await loadBootstrap(date); showToast("已记录一组");
  } catch (error) { showToast(error.message, "error"); }
}

async function toggleGoal(id) {
  const goal = app.data.goals.find((item) => item.id === id);
  if (!goal) return;
  try { await request(`goals/${id}`, { method: "PUT", body: { achieved: !goal.achieved } }); await loadBootstrap(); showToast(goal.achieved ? "目标重新打开" : "目标已达成"); } catch (error) { showToast(error.message, "error"); }
}

async function saveSettings(form) {
  try { await request("settings", { method: "PUT", body: { expectedVersion: app.data.version, settings: Object.fromEntries(new FormData(form).entries()) } }); await loadBootstrap(); showToast("偏好已保存"); } catch (error) { showToast(error.message, "error"); }
}

async function savePlan() {
  const form = $("#plan-form");
  const weeklyPlan = {};
  for (let day = 1; day <= 7; day += 1) weeklyPlan[day] = { kind: form.elements[`day-${day}-kind`].value, blockId: form.elements[`day-${day}-block`].value || null, cardioDesc: form.elements[`day-${day}-cardio`].value };
  try { app.previousPlan = structuredClone(app.data.weeklyPlan); await request("plan", { method: "PUT", body: { expectedVersion: app.data.version, weeklyPlan } }); await loadBootstrap(); $("#undo-plan").classList.remove("hidden"); showToast("未来计划已保存"); } catch (error) { showToast(error.message, "error"); }
}

async function undoPlan() {
  if (!app.previousPlan) return;
  try { await request("plan", { method: "PUT", body: { expectedVersion: app.data.version, weeklyPlan: app.previousPlan } }); app.previousPlan = null; $("#undo-plan").classList.add("hidden"); await loadBootstrap(); showToast("已撤销最近一次计划修改"); } catch (error) { showToast(error.message, "error"); }
}

async function addBlock(form) {
  try { await request("blocks", { method: "POST", body: Object.fromEntries(new FormData(form).entries()) }); form.reset(); await loadBootstrap(); showToast("训练块已添加"); } catch (error) { showToast(error.message, "error"); }
}

async function addExercise(form) {
  try { await request("exercises", { method: "POST", body: Object.fromEntries(new FormData(form).entries()) }); form.reset(); await loadBootstrap(); showToast("动作已添加"); } catch (error) { showToast(error.message, "error"); }
}

async function duplicateBlock(id) {
  try { await request(`blocks/${id}`, { method: "POST", body: { duplicate: true } }); await loadBootstrap(); showToast("训练块副本已创建"); } catch (error) { showToast(error.message, "error"); }
}

async function editExercise(id) {
  const exercise = app.data.exercises.find((item) => item.id === id);
  if (!exercise) return;
  const name = window.prompt("动作名称", exercise.name);
  if (!name) return;
  const targetPart = window.prompt("目标部位", exercise.targetPart || "");
  const sets = window.prompt("组数", exercise.sets || "");
  const reps = window.prompt("次数/时长", exercise.reps || "");
  try { await request(`exercises/${id}`, { method: "PUT", body: { name, targetPart, sets: sets ? Number(sets) : null, reps } }); await loadBootstrap(); showToast("动作已更新"); } catch (error) { showToast(error.message, "error"); }
}

async function moveExercise(id, direction) {
  const exercise = app.data.exercises.find((item) => item.id === id);
  if (!exercise) return;
  const siblings = app.data.exercises.filter((item) => item.blockId === exercise.blockId).sort((left, right) => left.sortOrder - right.sortOrder);
  const index = siblings.findIndex((item) => item.id === id);
  const other = siblings[index + (direction === "up" ? -1 : 1)];
  if (!other) return;
  try { await request("exercises/reorder", { method: "POST", body: { firstId: exercise.id, secondId: other.id, expectedVersion: app.data.version } }); await loadBootstrap(); showToast("动作顺序已更新"); } catch (error) { showToast(error.message, "error"); }
}

async function archiveExercise(id) {
  if (!window.confirm("归档后不会出现在新计划中，但历史记录会保留。继续吗？")) return;
  try { await request(`exercises/${id}`, { method: "DELETE", body: {} }); await loadBootstrap(); showToast("动作已归档"); } catch (error) { showToast(error.message, "error"); }
}

async function markPartial(id) {
  try { await request(`sessions/${id}`, { method: "PUT", body: { status: "partial" } }); await loadBootstrap(); showToast("已标记为部分完成"); } catch (error) { showToast(error.message, "error"); }
}

async function editGoal(id) {
  const goal = app.data.goals.find((item) => item.id === id);
  if (!goal) return;
  const text = window.prompt("目标内容", goal.text);
  if (!text || text === goal.text) return;
  try { await request(`goals/${id}`, { method: "PUT", body: { text } }); await loadBootstrap(); showToast("目标已更新"); } catch (error) { showToast(error.message, "error"); }
}

async function editRecord(id) {
  const record = app.data.records.find((item) => item.id === id);
  if (!record) return;
  const reps = window.prompt("实际次数（留空保持不变）", record.reps ?? "");
  if (reps === null) return;
  try { await request(`records/${id}`, { method: "PUT", body: { reps: reps === "" ? null : Number(reps) } }); await loadBootstrap(); showToast("训练记录已更新"); } catch (error) { showToast(error.message, "error"); }
}

async function deleteRecord(id) {
  if (!window.confirm("确定删除这条训练记录吗？")) return;
  try { await request(`records/${id}`, { method: "DELETE", body: {} }); await loadBootstrap(); showToast("训练记录已删除"); } catch (error) { showToast(error.message, "error"); }
}

async function addGoal(form) {
  try { await request("goals", { method: "POST", body: Object.fromEntries(new FormData(form).entries()) }); form.reset(); await loadBootstrap(); showToast("目标已添加"); } catch (error) { showToast(error.message, "error"); }
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

async function exportJson() { try { const data = await request("export"); app.data.version = data.version; app.data.backup = data.state.backup; app.lastBackupVersion = data.version; download(`fitness-backup-${app.data.today}.json`, JSON.stringify(data, null, 2), "application/json"); showToast("JSON 备份已导出"); } catch (error) { showToast(error.message, "error"); } }

async function exportCsv() { try { const data = await request("export"); app.data.version = data.version; app.data.backup = data.state.backup; app.lastBackupVersion = data.version; const rows = [["date", "exercise", "weight", "unit", "reps", "duration", "distance", "notes"]]; for (const record of data.state.records) { const exercise = data.state.exercises.find((item) => item.id === record.exerciseId); rows.push([record.actualDate, exercise?.name || record.exerciseName || "", record.weight ?? "", record.unit || "", record.reps ?? "", record.duration ?? "", record.distance ?? "", record.notes || ""]); } download(`fitness-history-${app.data.today}.csv`, rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8"); showToast("CSV 已导出"); } catch (error) { showToast(error.message, "error"); } }

async function importBackup(file) {
  try {
    const imported = JSON.parse(await file.text());
    const preview = imported.state || imported;
    if (!window.confirm(`将导入 ${preview.sessions?.length || 0} 个训练会话，默认合并现有数据。继续吗？`)) return;
    app.data = await request("import", { method: "POST", body: { state: preview, replace: false } });
    render();
    showToast("备份已导入");
  } catch (error) { showToast(error.message, "error"); }
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "auth-form") { try { await request("auth", { method: "POST", body: { passcode: form.passcode.value } }); form.reset(); $("#auth-error").textContent = ""; await loadBootstrap(); } catch (error) { $("#auth-error").textContent = error.message; } }
  if (form.id === "recovery-form") { try { await request("auth/recover", { method: "POST", body: Object.fromEntries(new FormData(form).entries()) }); form.reset(); $("#auth-error").textContent = ""; await loadBootstrap(); showToast("访问已恢复"); } catch (error) { $("#auth-error").textContent = error.message; } }
  if (form.id === "record-form" || form.classList.contains("record-form")) await submitRecord(form);
  if (form.classList.contains("cardio-form")) await submitRecord(form);
  if (form.id === "goal-form") await addGoal(form);
  if (form.id === "block-form") await addBlock(form);
  if (form.id === "exercise-form") await addExercise(form);
  if (form.id === "settings-form") await saveSettings(form);
  if (form.id === "password-form") { try { await request("auth/change", { method: "POST", body: Object.fromEntries(new FormData(form).entries()) }); form.reset(); showToast("访问口令已更新"); } catch (error) { showToast(error.message, "error"); } }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, [data-initialize]");
  if (!target) return;
  if (target.dataset.view) { switchView(target.dataset.view); return; }
  if (target.dataset.initialize) { await initialize(target.dataset.initialize); return; }
  if (target.dataset.day) { app.activeDate = target.dataset.day; renderToday(); return; }
  if (target.dataset.quick) { await quickComplete(target.dataset.quick); return; }
  if (target.dataset.skip) { await skipWorkout(target.dataset.skip); return; }
  if (target.dataset.reschedule) { await rescheduleWorkout(target.dataset.reschedule); return; }
  if (target.dataset.partial) { await markPartial(target.dataset.partial); return; }
  if (target.dataset.goalToggle) { await toggleGoal(target.dataset.goalToggle); return; }
  if (target.dataset.editGoal) { await editGoal(target.dataset.editGoal); return; }
  if (target.dataset.editRecord) { await editRecord(target.dataset.editRecord); return; }
  if (target.dataset.deleteRecord) { await deleteRecord(target.dataset.deleteRecord); return; }
  if (target.dataset.editExercise) { await editExercise(target.dataset.editExercise); return; }
  if (target.dataset.archiveExercise) { await archiveExercise(target.dataset.archiveExercise); return; }
  if (target.dataset.moveExercise) { await moveExercise(target.dataset.moveExercise, target.dataset.direction); return; }
  if (target.dataset.duplicateBlock) { await duplicateBlock(target.dataset.duplicateBlock); return; }
  if (target.id === "logout-button") { await request("auth", { method: "DELETE" }).catch(() => {}); showAuth(); return; }
  if (target.id === "history-refresh") { await refreshHistory().catch((error) => showToast(error.message, "error")); return; }
  if (target.id === "save-plan") { await savePlan(); return; }
  if (target.id === "undo-plan") { await undoPlan(); return; }
  if (target.id === "export-json") { await exportJson(); return; }
  if (target.id === "export-csv") { await exportCsv(); return; }
  if (target.id === "reset-data") { if (window.confirm("确定清空全部数据吗？请先导出 JSON 备份。")) { const confirmation = window.prompt("请输入 RESET 确认"); try { app.data = await request("reset", { method: "POST", body: { confirm: confirmation, backupVersion: app.lastBackupVersion || app.data.version } }); render(); showToast("数据已清空"); } catch (error) { showToast(error.message, "error"); } } }
});

for (const input of [$("#import-json"), $("#onboarding-import")]) input.addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (file) await importBackup(file); event.target.value = ""; });

$("#history-from").value = addDays(new Date().toISOString().slice(0, 10), -30);
$("#history-to").value = new Date().toISOString().slice(0, 10);

loadBootstrap().catch((error) => { if (error.status !== 401) $("#auth-error").textContent = error.message; });

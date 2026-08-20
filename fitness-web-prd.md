# 健身计划 Web 应用 —— 需求说明（PRD 定稿 v1.2）

> 交付对象：编程 Agent（按此文档实现）
> 部署：Cloudflare（Pages + Workers/Functions + D1）
> 数据路线：**路线1（已确认）—— Pages + Workers + D1**，数据云持久、多设备同步
> 界面：中文、深色主题默认、响应式（手机可用）、单用户无登录

---

## 1. 需求概述

单人居家健身者使用的 Web 应用，三类功能：
1. 展示训练计划（周计划表 + 动作库）
2. 打卡记录（动作/部位/重量/组数/次数/备注），刷新不丢、多设备同步
3. 更新训练计划（改训练块动作 / 改周计划 / 目标管理）

---

## 2. 架构

```
浏览器 → Cloudflare Pages(静态前端)  /api/* → Pages Functions(即 Worker) → D1 数据库
```

- **前端**：静态单页应用（响应式、深色主题）
- **API**：用 **Cloudflare Pages Functions**（目录 `functions/api/*`），与前端同项目、一次发布，无需单独 Worker
- **数据库**：D1（Cloudflare 的 SQLite 兼容服务数据库）
- **发布**：`wrangler pages deploy`（前端+Functions 一起）；D1 用 `wrangler d1 create` + `wrangler d1 execute --file=seed.sql`

---

## 3. 功能需求

### P0
- **F1 计划展示**：周计划表 Day1-7（块/有氧/休息）+ 动作库（A推/B拉/C下肢 各动作 组数×次数+要点），今日高亮
- **F2 打卡**：今日计划项一键"标记完成" + 手动新增记录；字段：日期/动作/部位/重量/单位/组数/次数/休息/备注；持久化；已完成日 ✓
- **F3 历史进度**：按动作趋势曲线；最近记录列表；累计天数/本周完成数统计

### P1
- **F4 编辑计划**：改训练块（增删改动作/组数/要点）、改周计划（某天=块/有氧/休息，支持循环模板）、即时保存
- **F5 目标管理**：列出周期目标，可标记达标

### P2（可选）
- F6 训练日提醒（本地通知）｜F7 多周期轮换

---

## 4. 数据模型（D1 表结构 SQL）

```sql
CREATE TABLE blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- push / pull / legs / cardio
  description TEXT
);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id INTEGER REFERENCES blocks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_part TEXT,
  sets INTEGER,
  reps TEXT,                       -- "20" / "15-20" / "力竭" / "30秒"
  note TEXT
);

CREATE TABLE schedule (
  day INTEGER PRIMARY KEY,         -- 1..7
  kind TEXT NOT NULL,              -- block / cardio / rest
  block_id INTEGER REFERENCES blocks(id),
  cardio_desc TEXT
);

CREATE TABLE workout_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,              -- YYYY-MM-DD
  exercise TEXT NOT NULL,
  target_part TEXT,
  weight REAL,
  unit TEXT DEFAULT 'kg',
  sets INTEGER,
  reps INTEGER,
  rest_time INTEGER,               -- 秒
  notes TEXT
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  achieved INTEGER DEFAULT 0
);
```

---

## 5. API 设计（REST，Pages Functions 实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/blocks | 全部训练块 |
| POST/PUT/DELETE | /api/blocks(/id) | 增改删块 |
| GET | /api/exercises?block_id= | 动作列表 |
| POST/PUT/DELETE | /api/exercises(/id) | 增改删动作 |
| GET | /api/schedule | 7 天计划 |
| PUT | /api/schedule/:day | 改某天安排 |
| GET | /api/logs?exercise= | 打卡列表（可按动作过滤） |
| POST/PUT/DELETE | /api/logs(/id) | 增改删打卡 |
| GET | /api/goals | 目标列表 |
| POST/PUT | /api/goals(/id) | 增改/标记达标 |

返回 JSON；错误返回 `{error: msg}` + 合适状态码。

---

## 6. 页面

| 页面 | 内容 |
|------|------|
| 首页/计划 | 周计划卡（今日高亮）+ 动作库 |
| 打卡 | 今日快速勾选 + 手动新增表单 |
| 历史 | 打卡列表 + 趋势图 + 统计卡 |
| 设置/编辑 | 编辑块 / 周计划 / 目标 |

---

## 7. 技术栈建议

- 前端：HTML+CSS+原生 JS，或 Vue/React（单页、响应式、深色主题）
- 图表：Chart.js / ECharts
- API：Cloudflare Pages Functions（`/functions/api/*.js`）
- DB：D1，初始数据用 `seed.sql`（见 `fitness-web-seed.sql`）

---

## 8. 验收标准

- [ ] `wrangler d1 create` + `wrangler d1 execute --file=seed.sql` 建库并灌入种子数据
- [ ] `wrangler pages deploy` 一次发布，打开即见计划、今日高亮、A/B/C 动作库齐全
- [ ] 打卡后**跨设备**（换浏览器/手机）都能看到同一份数据
- [ ] 刷新不丢，计划表出现 ✓
- [ ] 可查动作趋势曲线
- [ ] 可改训练块 / 周计划并生效
- [ ] 移动端正常打卡

---

## 9. 初始种子数据

见单独文件 **`~/fitness-web-seed.sql`**：训练块 A/B/C、各动作（组数次数要点）、当前 7 天周计划、周期目标。部署时执行即可，无需手工录入。
（旧打卡记录暂不导入，用户可选。）

---

## 10. 备注 / 后续

- 训练计划演进时，可由 Hermes 生成新的 seed 片段同步进该应用（用户可选项）
- D1 免费层对单人打卡完全够用

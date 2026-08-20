# Fitness Manager

Astro 7 + Tailwind CSS 4 + Motion + Cloudflare Pages Functions + D1 的单用户健身计划 Web 应用。

## 本地开发

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm build
pnpm exec wrangler pages dev dist --local
```

打开 Wrangler 输出的本地地址，默认开发口令来自 `.dev.vars`。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```

测试以浏览器请求 → Pages Functions API → D1/测试存储为最高 seam；当前 Node 测试使用内存存储验证同一 API 行为，部署前可用 Wrangler 本地 D1 做完整验收。

## D1 部署准备

1. 复制 `wrangler.toml.example` 为 `wrangler.toml`，填入 D1 `database_id`。
2. 创建数据库并执行 `schema.sql`。
3. 在 Cloudflare Pages/项目环境配置 `ACCESS_PASSPHRASE` 和独立的 `ACCESS_RECOVERY_TOKEN` secret。
4. 执行 `pnpm build`，再使用 Pages 部署命令发布 `dist` 和 Functions。

首次进入应用时，可选择内置 A/B/C 示例计划或空白计划。示例初始化由 API 幂等处理，不会覆盖已有数据。

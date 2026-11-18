---
file: YYC3-开发者-技术栈升级对齐.md
title: YYC³ 开发者技术栈升级对齐 — Next.js 16 核心迁移指南
description: Next 16、React 19、Tailwind 4、Jest 30 与 ESLint 扁平配置迁移指南
author: YYC³ Team <admin@0379.email>
version: v1.0.0
created: 2026-11-18
updated: 2026-11-18
status: stable
tags: [upgrade, nextjs, react, developer-guide]
category: guide
language: zh-CN
audience: developers,managers
complexity: intermediate
project: yyc3-smart-office
phase: development
review_status: reviewed
---

# YYC³ 开发者技术栈升级对齐 — Next.js 16 核心迁移指南

> **_YYC³_**（YanYuCloudCube™ · 注册商标）
> _言启象限 | 语枢未来_
> **_Words Initiate Quadrants, Language Serves as Core for Future_**
> _万象归元于云枢 | 深栈智启新纪元_
> **_All things converge in cloud pivot; Deep stacks ignite a new era of intelligence_**

---

## 核心理念

**五高架构**：高可用 | 高性能 | 高安全 | 高扩展 | 高智能
**五标体系**：标准化 | 规范化 | 自动化 | 可视化 | 智能化
**五化转型**：流程化 | 数字化 | 生态化 | 工具化 | 服务化
**五维评估**：时间维 | 空间维 | 属性维 | 事件维 | 关联维

---

## 一、升级基线

本指南记录 YYC³ Smart-Office 于 2026-11-18 完成的核心技术栈升级，后续开发以本表为准。

| 层次 | 组件 | 升级前 | 升级后 |
| ---- | ---- | ---- | ---- |
| 运行时 | Node.js | ≥20 | ≥20.9.0，推荐 20.19.5 |
| 框架 | Next.js | 15.5.x | 16.4.6（Turbopack 构建） |
| UI | React / React DOM | 18.3.1 | 19.3.1 |
| 类型 | @types/react / @types/react-dom | 18.x | 19.3.0 |
| 语言 | TypeScript | 5.9.3 | 保持 5.9.3（避免 TS7 非必要破坏） |
| 模块体系 | package.json | CommonJS 默认 | `"type": "module"` ESM |
| 样式 | Tailwind CSS | 3.4.x | 4.3.5 + `@tailwindcss/postcss` |
| 校验 | Zod | 3.25.76 | 4.6.7 |
| 表单 | @hookform/resolvers | 3.x | 7.0.7 |
| 测试 | Jest / jsdom / @types/jest | 29.x | 30.5.2 / 30.5.2 / 30.0.0 |
| Lint | ESLint / eslint-config-next | 8.x / 14.x | 9.39.5 / 16.4.6（扁平配置） |
| 日历 | react-day-picker | 8.10.1 | 10.0.2 |
| 包管理 | pnpm | 10.4.1 | 保持 10.4.1，单包结构不变 |

## 二、关键迁移点

### 2.1 Next.js 16

- `next lint` 已移除，统一使用 `pnpm lint`（脚本为 `eslint .`）。
- `next.config.mjs` 中 `eslint` 配置项已废弃并删除；`typescript.ignoreBuildErrors` 保留且为 `false`。
- 根级 `middleware.ts` 已迁移为 `proxy.ts`，导出函数由 `middleware` 改为 `proxy`；`config.matcher` 保持不变。
- `experimental-edge` 运行时配置已移除。
- `images.domains` 改为 `images.remotePatterns`。

### 2.2 React 19

- 全局 `JSX.Element` 改为 `React.JSX.Element`。
- `react-day-picker` v10 使用新的 `classNames` 键（`month_caption`、`month_grid`、`day_button` 等）与 `components.Chevron`，不再支持 `initialFocus`。
- 新增的 React Compiler lint 规则中，`set-state-in-effect` 与 `purity` 暂列为分阶段整改项，已在 `eslint.config.mjs` 中显式关闭；`static-components` 已通过把渲染内组件提升到模块作用域修复。

### 2.3 Tailwind CSS 4

- `app/globals.css` 顶部改为：

```css
@import "tailwindcss";
@config "../tailwind.config.ts";
```

- `postcss.config.mjs` 使用 `@tailwindcss/postcss`。
- `tailwind.config.ts` 启用 ESM 后不再产生模块类型警告。
- `darkMode` 调整为 `['class', 'dark']`。

### 2.4 依赖安全

- `pnpm run audit` 脚本通过 `npm_config_registry=https://registry.npmjs.org` 强制官方漏洞库，避免本地镜像缺失 audit 接口。
- 通过 `pnpm.overrides` 修复 `ws`、`nanoid`、`browserslist`、`source-map-js`、`yaml`、`@babel/core`、`baseline-browser-mapping` 等传递依赖漏洞。
- 当前审计结果：`No known vulnerabilities found`。

## 三、常用命令

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm run audit
pnpm build
```

> `pnpm test:coverage` 当前因覆盖率约 5.24% 低于 80% 阈值而失败。该失败是真实门禁结果，禁止通过降低阈值或 `continue-on-error` 掩盖。

## 四、CI/CD 对齐

- CI 使用 Node `20.19.5` 与 pnpm `10.4.1`，新增 `workflow_dispatch`。
- CI 严格顺序：install → lint → typecheck → test+coverage → audit → build；无 `continue-on-error`。
- Docker 构建阶段通过 `ARG` 接收 `DATABASE_URL`、`JWT_SECRET`、`IP_HASH_SALT`、`CORS_ORIGIN` 的构建期占位值；生产运行时仍由 Kubernetes Secret 注入真实配置。
- CD 使用 Node `20.19.5`，并把构建期占位配置通过 `build-args` 传入。

## 五、已知技术债

| 项目 | 状态 | 处理原则 |
| ---- | ---- | ---- |
| 覆盖率约 5.24% | 未闭环 | 按核心链路补测，不降低阈值 |
| ESLint 13 条 warning | 未闭环 | 以 warning 形式登记，后续清理未使用变量 |
| `set-state-in-effect` / `purity` 规则关闭 | 分阶段整改 | 需建立 React Compiler 专项任务后恢复 |
| 生产 Secret 托管方式 | 待确认 | 通过运维平台确认，不写入仓库 |
| Tailwind 配置仍为 `.ts` | 可接受 | 已启用 ESM，构建无警告 |

## 六、验收命令

```bash
pnpm lint       # 0 errors
pnpm typecheck  # 0 errors
pnpm test       # 8 suites passed
pnpm run audit      # No known vulnerabilities found
pnpm build      # Next 16.4.6 standalone build success
```

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0.0 | 2026-11-18 | 建立 Next 16 核心升级后的开发者对齐指南 | YYC³ Team |

---

<p align="center">
  <b>YYC³</b>（YanYuCloudCube™ · 注册商标）<br>
  言启象限 | 语枢未来<br>
  <i>Words Initiate Quadrants, Language Serves as Core for Future</i><br>
  万象归元于云枢 | 深栈智启新纪元<br>
  <i>All things converge in cloud pivot; Deep stacks ignite a new era of intelligence</i><br>
  <sub>© 2026 YanYuCloudCube™（YYC³）· <a href="mailto:admin@0379.email">admin@0379.email</a></sub>
</p>

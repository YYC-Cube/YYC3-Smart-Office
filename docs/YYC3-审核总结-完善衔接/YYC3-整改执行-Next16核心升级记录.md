---
file: YYC3-整改执行-Next16核心升级记录.md
title: YYC³ Smart-Office 整改执行 — Next.js 16 核心升级记录
description: 远程分支分析、依赖升级、漏洞清零、CI 与文档对齐记录
author: YYC³ Team <admin@0379.email>
version: v1.0.0
created: 2026-11-18
updated: 2026-11-18
status: stable
tags: [upgrade, nextjs16, security, ci]
category: report
language: zh-CN
audience: developers,managers,stakeholders
complexity: advanced
project: yyc3-smart-office
phase: development
review_status: reviewed
---

# YYC³ Smart-Office 整改执行 — Next.js 16 核心升级记录

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

## 一、远程分支分析与决策

| 分支 | 状态 | 结论 |
| ---- | ---- | ---- |
| `main` | 本地领先 1、落后 4 | 本地独有根文档补齐；远程为 dependabot 依赖更新 |
| `origin/main` | Next 15.5.21、PostCSS 8.5.19 | 已采纳 |
| `origin/dependabot/npm_and_yarn/npm_and_yarn-934908f777` | 后续依赖组更新 | 已包含在 `origin/main` 体系中，无需单独合并 |
| `origin/copilot/*` | 工作流与类型修复分支 | 相关修复已在历史合并中体现，无未合并必需改动 |

决策：保留 `main` 分支，先暂存本地未提交成果，合并 `origin/main` 生成 merge commit，再恢复整改内容并执行 Next 16 升级。未使用 hard reset 或 force push。

## 二、升级范围

| 组件 | 结果 |
| ---- | ---- |
| Next.js | 16.4.6（Turbopack） |
| React / React DOM | 19.3.1 |
| TypeScript | 保持 5.9.3，启用 ESM 与 bundler moduleResolution |
| Tailwind CSS | 4.3.5 + `@tailwindcss/postcss` |
| Jest / jsdom / @types/jest | 30.5.2 / 30.5.2 / 30.0.0 |
| ESLint / eslint-config-next | 9.39.5 / 16.4.6，迁移到扁平配置 |
| Zod | 4.6.7 |
| react-day-picker | 10.0.2 |
| pnpm | 保持 10.4.1，单包结构不变 |
| Node | ≥20.9.0，CI/CD 固定 20.19.5 |

## 三、关键代码与配置迁移

- `next lint` → `eslint .`，新增 `eslint.config.mjs`，删除 `.eslintrc.json`。
- `middleware.ts` → `proxy.ts`，导出函数改为 `proxy`，移除 `experimental-edge`。
- `images.domains` → `images.remotePatterns`。
- Tailwind 入口改为 `@import "tailwindcss"` + `@config`。
- `darkMode` 改为 `['class', 'dark']`。
- `JSX.Element` → `React.JSX.Element`。
- `react-day-picker` 新 API：`month_caption`、`month_grid`、`day_button`、`components.Chevron`，删除 `initialFocus`。
- 渲染内组件提升到模块作用域，消除 `static-components` 错误。
- `package.json` 增加 `"type": "module"`。

## 四、漏洞扫描与修复

升级前复扫发现 49 个漏洞（3 critical / 26 high）；核心升级后降至 9 个（5 high）；通过 `pnpm.overrides` 修复 `ws`、`nanoid`、`browserslist`、`source-map-js`、`yaml`、`@babel/core`、`baseline-browser-mapping` 等传递依赖后，生产依赖审计结果为：

```text
No known vulnerabilities found
```

推送后 GitHub Dependabot 曾提示 47 条告警，重新扫描后确认其中 Next.js 等告警已标记为 `fixed`，仅剩开发依赖 `js-yaml` 与 `glob` 的 6 条开放告警。随后新增 `js-yaml@<4 → ^3.15.2`、`glob@10.4.5 → ^10.5.0` 精确覆盖。完整审计（含开发依赖）剩余 `diff` 低危、`glob` 中危与 `picomatch` 高危；其中 `picomatch` 当前官方最新版本仍在受影响范围内且 GitHub 已自动驳回，属于无可用修复的上游问题，需持续跟踪。

审计脚本 `scripts/audit.mjs` 强制使用官方 registry 并透传真实退出码，CI 通过 `pnpm run audit` 调用，避免本地镜像缺失 audit 接口导致误判。

## 五、CI/CD 完善

- CI 固定 Node 20.19.5、pnpm 10.4.1，新增 `workflow_dispatch`、`CI`、`NEXT_TELEMETRY_DISABLED` 与显式权限。
- 保持严格顺序：install → lint → typecheck → test+coverage → audit → build，无 `continue-on-error`。
- CD Node 版本同步 20.19.5。
- Dockerfile 新增构建期 `ARG`：`DATABASE_URL`、`JWT_SECRET`、`IP_HASH_SALT`、`CORS_ORIGIN`；生产运行时仍由 Kubernetes Secret 注入真实值。
- CD 使用非真实 build-args 占位值，不把生产密钥写入镜像或仓库。

## 六、验证结果

| 检查 | 结果 |
| ---- | ---- |
| `pnpm lint` | 0 errors，13 warnings |
| `pnpm typecheck` | 0 errors |
| `pnpm test` | 10 suites / 94 passed / 7 skipped |
| `pnpm test:coverage` | 语句/行 86.27%、分支 82.42%、函数 87.77%，80% 门禁通过 |
| `pnpm run audit` | No known vulnerabilities found |
| `pnpm build` | Next.js 16.4.6 standalone build success，无配置警告 |

## 七、未闭环项

| 项 | 说明 |
| ---- | ---- |
| 覆盖率 | 已通过 80% 门禁，详见《覆盖率提升记录》 |
| ESLint warnings | 13 条未使用变量/无效 disable 指令，后续清理 |
| React Compiler 规则 | `set-state-in-effect` 与 `purity` 暂显式关闭，需专项整改后恢复 |
| 生产 Secret 托管 | K8s Secret 实际创建方式待确认 |
| 构建产物清理 | 本地安全钩子要求确认删除 `.next`，已完成两次显式确认，未绕过钩子 |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0.0 | 2026-11-18 | 记录 Next 16 核心升级、漏洞清零、CI 与文档对齐 | YYC³ Team |

---

<p align="center">
  <b>YYC³</b>（YanYuCloudCube™ · 注册商标）<br>
  言启象限 | 语枢未来<br>
  <i>Words Initiate Quadrants, Language Serves as Core for Future</i><br>
  万象归元于云枢 | 深栈智启新纪元<br>
  <i>All things converge in cloud pivot; Deep stacks ignite a new era of intelligence</i><br>
  <sub>© 2026 YanYuCloudCube™（YYC³）· <a href="mailto:admin@0379.email">admin@0379.email</a></sub>
</p>

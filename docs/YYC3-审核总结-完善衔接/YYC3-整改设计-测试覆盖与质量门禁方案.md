---
file: YYC3-整改设计-测试覆盖与质量门禁方案.md
title: YYC³ Smart-Office 整改设计 — 测试覆盖与质量门禁方案
description: 测试分层、覆盖率补齐路径、CI 停闸规则与失败判定
author: YYC³ Team <admin@0379.email>
version: v1.0.0
created: 2026-11-18
updated: 2026-11-18
status: stable
tags: [testing, coverage, ci-cd, quality-gate]
category: design
language: zh-CN
audience: developers,managers,stakeholders
complexity: intermediate
project: yyc3-smart-office
phase: development
review_status: reviewed
---

# YYC³ Smart-Office 整改设计 — 测试覆盖与质量门禁方案

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

## 一、现状基线

| 项目 | 实测值 | 判定 |
| ---- | ---- | ---- |
| 测试框架 | Jest 29.7.0 + Testing Library + jsdom | 已确认 |
| 测试套件 | 8 个，全部通过 | 通过 |
| 用例 | 54 passed / 7 skipped / 61 total | 通过但存在 skipped |
| 覆盖率 | statements 5.24%、branches 33.63%、functions 22.91%、lines 5.24% | 未通过 80% 阈值 |
| CI 历史门禁 | lint/test 均 `continue-on-error: true` | 已修复为严格失败 |
| 构建复测 | 被 IDE safe-delete 钩子拦截 | 环境阻塞 |

## 二、测试分层

| 层 | 范围 | 当前状态 | 目标 |
| ---- | ---- | ---- | ---- |
| 单元 | `lib/**`、`hooks/**`、纯函数 | 部分覆盖：password/csrf/ai-service/resilience-service 有测试 | 核心工具 100% 关键分支覆盖 |
| 接口 | `app/api/**/route.ts` | 仅 `test-resilience` 有路由测试 | 15 个 API 文件至少各有 1 正向 + 1 反向 |
| 组件 | `components/**` | 仅 logo 组件 | 关键表单、布局、错误态覆盖 |
| 集成 | 登录 → JWT → 权限 → DB | 无独立集成测试 | 建立端到端业务链路测试 |
| 环境/兼容 | Node、pnpm、PG、Redis、Docker、K8s、浏览器 | 仅本机 Node 22/pnpm 10.4.1 实测 | 按兼容性矩阵执行 |

## 三、覆盖率补齐路径

| 阶段 | 任务 | 目标模块 | 通过标准 |
| ---- | ---- | ---- | ---- |
| 阶段 1 | 补齐配置与基础设施测试 | `lib/env.ts`、`lib/db.ts`、`lib/logger.ts` | 缺配置 fail-fast、日志脱敏、DB 异常分支通过 |
| 阶段 2 | 补齐认证安全测试 | `lib/auth.ts`、`lib/csrf.ts`、登录路由 | 401/403/429/503 分支全覆盖 |
| 阶段 3 | 补齐 API 路由测试 | `app/api/**` | 每个路由至少 1 正向 + 1 反向，错误不泄露堆栈 |
| 阶段 4 | 补齐组件与页面测试 | 登录页、设置页、关键表单 | 渲染、校验、错误态通过 |
| 阶段 5 | 集成与兼容 | 完整登录链路、K8s 配置注入 | 健康检查 200，回滚演练通过 |

> 不以调低 `coverageThreshold` 达成「通过」；任何阈值调整必须提交书面风险接受并按变更评审执行。

## 四、本地与 CI 门禁

### 4.1 本地必须执行

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm run audit
pnpm build
```

在修复依赖漏洞与覆盖率前，`pnpm test:coverage` 与 `pnpm run audit` 预期失败，这是**正确的红灯**，不得通过 `--passWithNoTests`、降低阈值或 `continue-on-error` 掩盖。

### 4.2 CI 严格门禁

当前 `ci.yml` 顺序：安装 → ESLint → TypeScript → Test（含覆盖率）→ Dependency Audit → Build。

规则：

1. 任一步骤失败即终止后续发布流程。
2. 不允许 `continue-on-error`。
3. 不允许 `SKIP_ENV_VALIDATION` 或其他跳过校验的开关。
4. CI 使用一次性测试密钥，不复用生产密钥。
5. 依赖审计使用 `--config.registry=https://registry.npmjs.org` 规避本地镜像缺失 audit 接口的问题。
6. 构建产物复测需在没有 IDE safe-delete 拦截的环境执行；拦截属于环境阻塞，不是通过。

## 五、通过标准与失败判定

### 5.1 通过标准

- 0 failed tests；skipped 项有书面结论。
- 四项覆盖率均 ≥ 80%。
- lint 与 typecheck 0 errors。
- next build 成功，且未使用绕过开关。
- 依赖审计 0 critical、0 high，或全部有责任人与到期日的书面风险接受。
- 无真实密钥进入仓库、日志或构建产物。
- 健康检查与登录反向用例通过。

### 5.2 失败判定

| 现象 | 判定 | 处理 |
| ---- | ---- | ---- |
| 任一测试 failed | 不通过 | 修复后重跑，不标记跳过 |
| 覆盖率低于阈值 | 不通过 | 补测，不降阈值 |
| audit 发现 critical/high | 不通过 | 升级或书面风险接受 |
| 构建被环境钩子拦截 | 环境阻塞 | 记录原始输出，待环境允许后复核，不判定通过 |
| 命令未执行 | 未验证 | 不得写「通过」 |

## 六、测试数据与环境原则

- 使用合成账号与一次性数据库；禁止使用生产用户数据。
- 密钥通过 CI env 或 Secret 注入，测试结束后丢弃。
- 数据库测试连接串必须在执行前二次确认指向测试库。
- Redis 测试同时覆盖「配置齐全」与「缺失降级」两种模式。

## 七、缺陷回流闭环

1. 测试失败 → 记录用例 ID、命令、原始输出与环境。
2. 定位根因 → 更新问题分级清单并指定责任人与期限（待确认）。
3. 修复 → 增加回归用例，禁止仅修改断言使其通过。
4. 复核 → 按本报告通过标准重新执行全部门禁。
5. 归档 → 更新执行记录、问题清单与验收结论。

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0.0 | 2026-11-18 | 建立测试分层、覆盖率补齐路径与严格门禁规则 | YYC³ Team |

---

<p align="center">
  <b>YYC³</b>（YanYuCloudCube™ · 注册商标）<br>
  言启象限 | 语枢未来<br>
  <i>Words Initiate Quadrants, Language Serves as Core for Future</i><br>
  万象归元于云枢 | 深栈智启新纪元<br>
  <i>All things converge in cloud pivot; Deep stacks ignite a new era of intelligence</i><br>
  <sub>© 2026 YanYuCloudCube™（YYC³）· <a href="mailto:admin@0379.email">admin@0379.email</a></sub>
</p>

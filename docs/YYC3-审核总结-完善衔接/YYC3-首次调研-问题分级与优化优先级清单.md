---
file: YYC3-首次调研-问题分级与优化优先级清单.md
title: YYC³ Smart-Office 首次调研 — 问题分级与优化优先级清单
description: P0 至 P3 问题台账、整改状态与执行排序
author: YYC³ Team <admin@0379.email>
version: v1.0.0
created: 2026-11-18
updated: 2026-11-18
status: stable
tags: [audit, issue-triage, priority, risk]
category: report
language: zh-CN
audience: developers,managers,stakeholders
complexity: intermediate
project: yyc3-smart-office
phase: development
review_status: reviewed
---

# YYC³ Smart-Office 首次调研 — 问题分级与优化优先级清单

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

## 一、分级定义

| 级别 | 定义 | 处理原则 |
| ---- | ---- | ---- |
| P0 致命 | 可导致数据泄露、认证绕过、生产不可用或已知严重漏洞 | 立即止损；未闭环禁止上线 |
| P1 严重 | 显著降低质量、安全或可维护性，但暂未形成直接利用链 | 本迭代内闭环 |
| P2 一般 | 规范偏差、文档缺失、工具链过期 | 纳入近期计划 |
| P3 优化 | 体验、命名、排版与效率改进 | 按容量安排 |

## 二、P0 致命问题

| 编号 | 问题 | 证据 | 影响 | 当前状态 | 下一步 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| P0-01 | 数据库连接串内置默认弱口令 | 原 `lib/db.ts:14` `postgresql://postgres:password@...` | 未配置环境变量时可能连接错误数据库或使用弱凭据 | **已修复**：移除默认值，缺 `DATABASE_URL` 时 fail-fast | 补 DB 配置单元测试 |
| P0-02 | 登录路由硬编码三个账号密码哈希；`lib/auth.ts` 含模拟账号且密码校验恒真 | 原 `app/api/auth/login/route.ts:66-97`、`lib/auth.ts:78-109` | 硬编码凭据与认证绕过风险，违反用户硬约束 | **已修复**：删除回退账号；DB 异常返回 503；删除模拟校验函数 | 补登录反向用例并复核所有 API 签名校验 |
| P0-03 | `IP_HASH_SALT` 使用默认值 `default_salt` | 原 `app/api/auth/login/route.ts:114` | 限流哈希可预测，削弱 IP 维度防护 | **已修复**：改为环境变量必填，模板已补占位符 | 补缺配置用例 |
| P0-04 | CI 的 lint 与 test 使用 `continue-on-error: true`；Build 使用 `SKIP_ENV_VALIDATION` | 原 `.github/workflows/ci.yml:38,48,55` | 质量门禁形同虚设，失败被掩盖 | **已修复**：移除绕过项，新增 `pnpm typecheck` 与 `pnpm run audit` | 保持所有门禁严格失败 |
| P0-05 | K8s Deployment 未注入 `DATABASE_URL`/`JWT_SECRET` 等生产配置 | 原 `infra/k8s/deployment.yaml:28-38`、`configmap.yaml:6-9` | 容器缺少必需配置或回退到不安全默认值 | **清单与脚本已修复**：新增 `secretKeyRef` 与 `scripts/k8s-secrets.mjs`，dry-run 通过 | 生产集群上下文未配置，真实 Secret 创建与 Pod 启动仍待运维执行 |
| P0-06 | 生产依赖存在 49 个漏洞，含 3 critical、26 high | 原 `pnpm audit` 输出 | 已知 RCE 与高危漏洞，生产不可接受 | **已修复**：升级 Next.js 16 核心栈并通过覆盖清零生产漏洞；GitHub 开放告警为 0 | 持续跟踪无可用修复的上游条目 |
| P0-07 | 覆盖率 5.24%，四项阈值均低于 80% | 原 `jest --coverage` 输出 | 核心链路无回归保护，质量门禁持续红灯 | **已修复**：核心逻辑补测后四项 ≥80%，阈值未降低 | 继续补 skipped 用例与 Redis/熔断边界 |
| P0-08 | `pages.yml` 静态导出前删除 `app/api` | `.github/workflows/pages.yml:39` | 若产物对外发布则认证与 API 不可用 | **已收口**：改为手工确认的静态预览，不再随 main 自动发布，移除 `SKIP_ENV_VALIDATION` | 生产入口固定为 K8s 部署，Pages 仅供预览 |

## 三、P1 严重问题

| 编号 | 问题 | 证据 | 影响 | 当前状态 | 下一步 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| P1-01 | README 无证据评分并标记「通过验收」；技术版本过期 | 原 `README.md:9-18,23,41,95,119` | 对外传达虚假成熟度 | **已修复**：改为实测状态表并修正版本 | 后续每次大改同步状态表 |
| P1-02 | README 指示 `cp .env.example .env`，但文件不存在 | 原 `README.md:172`；仓库检索 | 新成员无法按文档启动 | **已修复**：新增仅含占位符的 `.env.example` | 确认生产模板与本地模板差异 |
| P1-03 | 生产 CORS 域名硬编码在 `next.config.mjs` | 原 `next.config.mjs:28` | 配置不可移植，违反环境变量注入要求 | **已修复**：改为 `CORS_ORIGIN` 环境变量，生产缺失即报错 | CI 与 K8s 已补该变量 |
| P1-04 | `lib/logger.ts` 直接 `JSON.stringify(data)`，无敏感字段脱敏 | 原 `lib/logger.ts:25,36` | 密码/令牌/PII 可能落盘和入库 | **已修复**：递归脱敏、令牌/连接串/IP 模式遮蔽，新增审计测试 | 持续复核敏感键名单 |
| P1-05 | `lib` 与 `hooks` 存在双向引用风险 | `lib/api-client.ts → hooks/use-csrf`；hooks → lib | 可能演变为循环依赖，破坏单向模块规范 | **待专项复核** | 绘制依赖图并拆出纯工具层 |
| P1-06 | Edge 中间件仅解码 JWT 载荷，不做签名校验 | 原 `middleware.ts:91-99,145` | 若有 API 路由未独立 `verifyToken`，可形成越权 | **已修复**：withApiHandler 实现 requireAuth 并为提醒/AI/DB/弹性接口启用，CSRF 改为 await | 持续审计新增 API 路由 |
| P1-07 | pre-commit 仅格式化，无密钥扫描与测试门禁 | 原 `.husky/pre-commit:4` | 误提交密钥与坏代码风险 | **已修复**：pre-commit 与 CI 加入密钥扫描、lint、typecheck、测试门禁 | 维护扫描规则白名单 |
| P1-08 | `next lint` 在 Next 16 移除 | `pnpm lint` 输出 | 工具链过期 | **已修复**：迁移 ESLint CLI 扁平配置 | 持续清理 warning |
| P1-09 | 构建复测被 IDE safe-delete 钩子拦截 | `pnpm build` 输出 | 无法确认整改后构建状态 | **环境阻塞** | 用户确认后清理 `.next` 再跑，不绕过钩子 |

## 四、P2 一般问题

| 编号 | 问题 | 证据 | 当前状态 | 下一步 |
| ---- | ---- | ---- | ---- | ---- |
| P2-01 | 7 个阶段目录与约 63 个文件命名偏离标规且多为占位存根 | `docs/YYC3-SO--*` | 未闭环 | 制定迁移映射，经批准后批量重命名/补全 |
| P2-02 | 缺少 CHANGELOG、系统上下文文档、生产环境运行状态文档 | 全库检索 | 未闭环 | 按文档闭环标准补建 |
| P2-03 | 无应用级 `src/app/docs/*-REFERENCE.ts` 等文档 | 标规命名规范；仓库无 `src/` | 未闭环 | 结合 Next 平铺结构调整应用级文档位置并批准 |
| P2-04 | 发布周期、干系人职责、性能 SLA 未文档化 | `CONTRIBUTING.md`、`SECURITY.md`、待确认清单 | 待确认 | 通过 C-02/C-03/C-04/C-05 收集 |
| P2-05 | HPA 阈值、Ingress 域名仍为占位 | `infra/k8s/hpa.yaml`、`ingress.yaml:12` | 待确认 | 运维确认生产参数后更新 |
| P2-06 | `next.config.mjs` 图片域名仍含 `assets.example.com` 占位 | `next.config.mjs:19` | 未闭环 | 明确生产资源域名后参数化 |

## 五、P3 优化问题

| 编号 | 问题 | 当前状态 | 建议 |
| ---- | ---- | ---- | ---- |
| P3-01 | 代码文件头未统一到团队 JSDoc 标准 | 未闭环 | 从 `lib/`、`hooks/` 核心文件起分批补齐 |
| P3-02 | Jest 有 7 项 skipped | 未闭环 | 明确是废弃用例还是待补用例 |
| P3-03 | README 仍使用多处 `<div align="center">` 徽章块 | 部分保留 | 不影响功能，可在下次文档改版统一 |
| P3-04 | `console.log/warn` 分散，缺统一结构化日志上下文 | 未闭环 | 收敛到 Logger 并加 trace_id |

## 六、优化优先级排序

1. **P0-06 依赖漏洞**：最高优先级，先处理 Next.js critical 与 high，避免已知 RCE 暴露。
2. **P0-07 覆盖率**：按登录/CSRF/JWT/DB 核心链路补测，目标是门禁真实变绿而非调低阈值。
3. **P0-08 静态导出用途确认**：确认前不得将 `pages.yml` 产物投入生产。
4. **P0-05 Secret 实际注入**：清单已修，需运维在集群完成 Secret 创建并验证探针。
5. **P1-04/P1-06 日志脱敏与鉴权覆盖**：安全纵深补齐。
6. **P1-05/P1-07/P1-08 模块边界、密钥扫描、lint 迁移**：降低后续回归概率。
7. **P2 文档与规范对齐**：建立可追溯闭环，支撑长期协作。

## 七、闭环判定规则

- 只有状态为「已修复」且有复测证据的条目可标记关闭。
- 「待确认」必须由责任人在受控渠道确认后更新，不得由 AI 或开发者代填。
- 「环境阻塞」需记录阻塞命令与原始输出，待环境允许后重跑；不得标记为通过。
- 任何 P0 未闭环时，项目验收结论只能为「需整改」，不得写「通过验收」。

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0.0 | 2026-11-18 | 建立 P0 至 P3 问题台账、优先级排序与闭环判定规则 | YYC³ Team |

---

<p align="center">
  <b>YYC³</b>（YanYuCloudCube™ · 注册商标）<br>
  言启象限 | 语枢未来<br>
  <i>Words Initiate Quadrants, Language Serves as Core for Future</i><br>
  万象归元于云枢 | 深栈智启新纪元<br>
  <i>All things converge in cloud pivot; Deep stacks ignite a new era of intelligence</i><br>
  <sub>© 2026 YanYuCloudCube™（YYC³）· <a href="mailto:admin@0379.email">admin@0379.email</a></sub>
</p>

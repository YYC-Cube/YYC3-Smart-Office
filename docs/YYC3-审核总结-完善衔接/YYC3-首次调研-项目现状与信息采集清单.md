---
file: YYC3-首次调研-项目现状与信息采集清单.md
title: YYC³ Smart-Office 首次调研 — 项目现状与信息采集清单
description: 业务技术代码协作四维信息采集、证据来源与待确认项
author: YYC³ Team <admin@0379.email>
version: v1.0.0
created: 2026-11-18
updated: 2026-11-18
status: stable
tags: [audit, discovery, inventory, handoff]
category: report
language: zh-CN
audience: developers,managers,stakeholders
complexity: intermediate
project: yyc3-smart-office
phase: development
review_status: reviewed
---

# YYC³ Smart-Office 首次调研 — 项目现状与信息采集清单

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

## 一、项目画像

**一句话总结**：这是一个基于 Next.js 15 App Router、PostgreSQL/Drizzle 与 Upstash Redis 的单包智能办公 Web 应用，具备认证、权限、审批、日程、库存、组织、AI 助手与系统诊断等业务模块，技术骨架可运行但质量门禁、密钥注入、依赖安全与文档对齐尚未达到生产放行标准。

**核心标签**：`Next.js 15.5.18` · `React 18.3.1` · `TypeScript 5.9` · `pnpm 10.4.1` · `PostgreSQL/Drizzle` · `Upstash Redis` · `Jest` · `Docker/K8s` · `单包非 workspace` · `需整改`

## 二、业务层采集

| 维度 | 已采集信息 | 证据 | 状态 |
| ---- | ---- | ---- | ---- |
| 核心目标 | 企业级智能办公综合解决方案，提升办公效率、优化管理流程、促进团队协作 | `README.md` 项目简介 | 已确认 |
| 适用场景 | 员工管理、文档管理、OA 审批、日程、客户跟进、AI 助手、系统管理 | `README.md` 功能模块；`app/` 路由目录 | 已确认 |
| 用户群体 | 系统至少需要管理员、部门经理、普通员工三类角色 | `app/api/auth/login/route.ts` 历史回退账号角色字段；`lib/schema.ts` role | 部分确认；真实用户画像待确认 |
| 核心业务流程 | 登录/注册 → CSRF 校验 → 业务页面访问 → API 路由读写数据库 → 日志与权限校验 | `app/api/auth/*`、`middleware.ts`、`lib/schema.ts` | 已确认技术链路 |
| 关键功能清单 | 组织、考勤/员工、日程、库存、审批、收银、聊天、客户跟进、文档、日志、消息中心、设置、AI 助手、系统健康/诊断 | `app/` 一级路由目录 | 已确认 |
| 性能需求 | 代码仅体现「数据库延迟 > 500ms 输出告警」与 K8s 资源限制，未见正式 SLA/SLO | `lib/db.ts:53-55`；`infra/k8s/deployment.yaml:55-61` | 待确认 |
| 安全需求 | JWT、CSRF、bcrypt、Zod、限流、安全头、生产密钥长度校验 | `SECURITY.md`、`lib/env.ts`、`middleware.ts` | 已确认；执行有效性待测试 |
| 可用性需求 | K8s 双副本、滚动更新、就绪/存活探针、HPA 配置存在 | `infra/k8s/deployment.yaml`、`hpa.yaml` | 已确认；实际 SLA 待确认 |

## 三、技术层采集

| 维度 | 已采集信息 | 证据 | 状态 |
| ---- | ---- | ---- | ---- |
| 前端框架 | Next.js 15.5.18，App Router，React 18.3.1 | `package.json:63,67,69,102-104` | 已确认 |
| 语言与样式 | TypeScript 5.9.3 strict，Tailwind CSS 3.4.18，shadcn/ui/Radix | `package.json:58,96`；`tsconfig.json:3` | 已确认 |
| 状态管理 | React Context 为主（AuthContext），未见 Zustand/Redux | `app/layout.tsx`、`contexts/auth-context.tsx` | 已确认 |
| 后端形态 | Next.js Route Handlers（REST/JSON），无独立外部后端服务证据 | `app/api/**/route.ts` | 已确认 |
| 数据库 | PostgreSQL + Drizzle ORM；连接池 max=10；生产 SSL rejectUnauthorized=true | `lib/db.ts:10-25`；`lib/schema.ts` | 已确认 |
| 数据库版本 | 团队约束目标为 PG15；仓库未锁定实际版本 | 用户需求约束；`README.md` 历史写 PostgreSQL 14+ | 待确认 |
| 缓存/中间件 | Upstash Redis 用于 CSRF 存储，环境变量齐全时启用，否则降级内存；AI 服务有内存缓存 | `lib/csrf.ts:30-80`；`lib/ai-service.ts` | 已确认 |
| 部署 | Docker 多阶段 standalone 镜像、docker-compose、K8s 六份清单、GHCR、GitHub Actions | `Dockerfile`、`docker-compose.yml`、`infra/k8s/**`、`.github/workflows/cd.yml` | 已确认 |
| CI/CD | `ci.yml`：安装→lint→typecheck→test→build；`cd.yml`：tag 触发构建推送并 `kubectl apply` | `.github/workflows/*.yml` | 已确认；门禁强度见问题清单 |
| 测试框架 | Jest 29.7.0 + Testing Library + jest-environment-jsdom；覆盖率阈值四项 80% | `package.json:80-98`；`jest.config.ts:29-36` | 已确认 |
| 包管理器 | pnpm 10.4.1；有 `pnpm-lock.yaml`；无 `pnpm-workspace.yaml`，当前为单包 | `package.json:100`；`pnpm-lock.yaml`；仓库检索 | 已确认 |

## 四、代码层采集

| 维度 | 已采集信息 | 证据 | 状态 |
| ---- | ---- | ---- | ---- |
| 仓库地址 | `ssh://git@ssh.github.com:443/YYC-Cube/YYC3-Smart-Office.git` | `git remote -v` | 已确认 |
| 基线 | `main` 分支，`9394ff4` | `git rev-parse` | 已确认 |
| 目录结构 | 无 `src/`；根目录 `app/`、`components/`、`hooks/`、`contexts/`、`lib/`、`middleware/`、`models/`、`types/`、`infra/`、`scripts/` | 根目录与 `app/` 列表 | 已确认 |
| 入口文件 | `app/layout.tsx` 为根布局，`app/page.tsx` 为首页；`contexts/auth-context.tsx` 提供全局鉴权上下文 | `app/layout.tsx` | 已确认 |
| 路由配置 | App Router 文件路由，业务路由 20+，API 路由 15 个文件 | `app/` 与 `app/api/` | 已确认 |
| 公共组件 | `components/ui/` 下约 52 个 shadcn/Radix 基础组件 | `components/ui/` | 已确认 |
| 公共工具/服务 | `lib/db.ts`、`schema.ts`、`auth.ts`、`csrf.ts`、`password.ts`、`api-client.ts`、`api-middleware.ts`、`ai-service.ts`、`resilience-service.ts`、`logger.ts`、`env.ts`、`validations.ts` | `lib/` | 已确认 |
| 数据模型 | `users`、`password_resets`、`logs`、`permissions`、`user_permissions` 五表 | `lib/schema.ts:4-54` | 已确认 |
| 第三方依赖 | Radix UI、react-hook-form、zod、recharts、lucide-react、next-themes、sonner、date-fns、drizzle-orm、postgres/pg/@vercel/postgres、@upstash/redis、bcrypt/bcryptjs、jsonwebtoken、Jest | `package.json:17-99` | 已确认 |
| 模块依赖方向 | 总体 `app → contexts/hooks → lib → middleware/models`；`lib/api-client.ts → hooks/use-csrf` 与 hooks 反向依赖 lib 存在双向耦合风险，未发现确凿循环依赖 | 静态引用检索 | 部分确认 |

## 五、协作层采集

| 维度 | 已采集信息 | 证据 | 状态 |
| ---- | ---- | ---- | ---- |
| 干系人与职责 | 维护者审查、贡献者、安全报告接收方有流程描述；具体人员分工未定义 | `CONTRIBUTING.md`、`SECURITY.md`、`README.md` | 待确认 |
| 提交规范 | Conventional Commits；类型含 feat/fix/docs/style/refactor/perf/test/build/chore | `CONTRIBUTING.md:15-23` | 已确认 |
| 分支规范 | `main`、`feat/*`、`fix/*`、`docs/*`、`dependabot/*` | `CONTRIBUTING.md:5-13` | 已确认 |
| 评审流程 | PR 通过 CI 与维护者审查后合并；无独立评审清单或审批矩阵 | `CONTRIBUTING.md:31` | 部分确认 |
| 发布周期 | tag 触发 CD；未定义常规发布节奏与冻结窗口 | `.github/workflows/cd.yml:3-7` | 待确认 |
| 问题反馈 | 普通问题 `admin@0379.email` 与 GitHub；安全问题 `security@0379.email`，48h 确认/7 工作日初评 | `README.md`、`SECURITY.md` | 已确认 |
| 文档闭环 | 团队标规已建立模板、追溯与迭代机制；项目自身缺少 CHANGELOG、系统上下文文档、生产运行状态文档 | `docs/YYC3-团队通用-标规文档/`；全库检索 | 部分确认 |

## 六、待确认清单

| 编号 | 待确认项 | 为何关键 | 确认路径 | 责任人 | 截止 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| C-01 | 真实生产数据库类型与版本是否为 PG15，以及是否为自研 PG15 + Redis 架构 | 决定连接参数、备份、扩容与兼容性测试范围 | 生产 `DATABASE_URL` 脱敏后的版本查询、DBA/运维确认、`infra/k8s` Secret 来源 | 待确认 | 待确认 |
| C-02 | 生产用户群体规模、角色边界与权限矩阵 | 决定 RBAC 测试用例与性能压测模型 | 产品经理/业务负责人访谈、权限表数据盘点 | 待确认 | 待确认 |
| C-03 | 正式性能与可用性指标（SLA/SLO、P95/P99、RPO/RTO） | 当前只有代码阈值，无法判定达标 | 产品/运维 SLA 文档、监控平台基线 | 待确认 | 待确认 |
| C-04 | 发布周期、版本冻结窗口与回滚审批人 | CD 已存在但流程未文档化 | 发布负责人、`cd.yml` 使用记录、Git tag 历史 | 待确认 | 待确认 |
| C-05 | 干系人名单与职责矩阵 | 问题分派与验收签字需要明确责任主体 | 项目章程/组织架构、团队通讯录（需授权） | 待确认 | 待确认 |
| C-06 | `pages.yml` 静态导出删除 `app/api` 的用途与发布目标 | 若对外发布，认证与 API 将不可用，属于潜在 P0 | 查看 `.github/workflows/pages.yml` 使用记录、询问维护者 | 待确认 | 待确认 |
| C-07 | 生产密钥实际托管方式（Sealed Secret/Vault/云 KM 等） | 决定 Secret 创建、轮转与灾备流程 | 运维平台配置、K8s Secret 清单来源 | 待确认 | 待确认 |
| C-08 | 是否允许为覆盖率不足签署书面豁免 | 当前门禁红灯，需管理决策而非技术绕过 | 质量负责人/项目发起人书面确认 | 待确认 | 待确认 |

> 上述待确认项均未以假设值写入技术结论；涉及真实密钥、账号与内部地址的内容必须通过受控渠道提供，不得写入仓库或本文档。

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0.0 | 2026-11-18 | 完成业务、技术、代码、协作四维采集并建立待确认清单 | YYC³ Team |

---

<p align="center">
  <b>YYC³</b>（YanYuCloudCube™ · 注册商标）<br>
  言启象限 | 语枢未来<br>
  <i>Words Initiate Quadrants, Language Serves as Core for Future</i><br>
  万象归元于云枢 | 深栈智启新纪元<br>
  <i>All things converge in cloud pivot; Deep stacks ignite a new era of intelligence</i><br>
  <sub>© 2026 YanYuCloudCube™（YYC³）· <a href="mailto:admin@0379.email">admin@0379.email</a></sub>
</p>

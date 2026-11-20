---
file: YYC3-整改设计-配置密钥与部署注入方案.md
title: YYC³ Smart-Office 整改设计 — 配置密钥与部署注入方案
description: 环境变量矩阵、Kubernetes Secret 注入、容灾与回滚设计
author: YYC³ Team <admin@0379.email>
version: v1.0.0
created: 2026-11-18
updated: 2026-11-18
status: stable
tags: [security, configuration, kubernetes, design]
category: design
language: zh-CN
audience: developers,managers,stakeholders
complexity: intermediate
project: yyc3-smart-office
phase: development
review_status: reviewed
---

# YYC³ Smart-Office 整改设计 — 配置密钥与部署注入方案

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

## 一、设计目标与硬约束

1. 所有密钥、口令、盐值、连接串、生产域名必须通过环境变量或 Kubernetes Secret 注入。
2. 仓库只允许存在 `.env.example` 占位模板，禁止真实值、Tailscale IP、节点内网地址与凭证。
3. 必填配置缺失时 fail-fast，不允许回退到内置默认口令或可预测盐值。
4. 不切换包管理器，不修改 pnpm workspace 架构；本项目当前为单包，保持现状。
5. 保留异常处理、容灾备份与回滚路径，不绕过任何安全钩子。

## 二、环境变量矩阵

| 变量 | 必填性 | 来源 | 消费方 | 校验 | 当前状态 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| `NODE_ENV` | 必填 | ConfigMap | 全局 | 由 K8s 固定为 `production` | 已注入 |
| `PORT` | 必填 | ConfigMap | Next standalone | 数字端口 | 已注入 |
| `DATABASE_URL` | 生产必填 | Secret | `lib/db.ts` | 非空；生产由 postgres-js SSL 校验 | 代码 fail-fast，清单已注入，集群待确认 |
| `JWT_SECRET` | 生产必填 | Secret | `lib/env.ts`、`lib/auth.ts` | 非空且 ≥ 32 字符 | 代码已校验，清单已注入 |
| `CSRF_SECRET` | 推荐 | Secret | `lib/csrf.ts` | 非空（若启用加密） | 清单已注入 |
| `IP_HASH_SALT` | 必填 | Secret | `app/api/auth/login/route.ts` | 非空 | 代码已 fail-fast，清单已注入 |
| `CORS_ORIGIN` | 生产必填 | Secret | `next.config.mjs` | 非空 | 代码已 fail-fast，清单已注入 |
| `UPSTASH_REDIS_REST_URL` | 多实例必填 | Secret | `lib/csrf.ts` | 与 TOKEN 成对出现 | 清单可选注入 |
| `UPSTASH_REDIS_REST_TOKEN` | 多实例必填 | Secret | `lib/csrf.ts` | 与 URL 成对出现 | 清单可选注入 |
| `NEXT_STATIC_EXPORT` | 可选 | CI 环境 | `next.config.mjs` | `0/1` | 模板已给出 |

## 三、本地与 CI 配置

### 3.1 本地开发

```bash
cp .env.example .env
# 在 .env 中替换所有 REPLACE_WITH_* 与 USER/PASSWORD/HOST/DB_NAME 占位符
pnpm dev
```

`.env` 已被 `.gitignore` 忽略；任何真实值不得提交。若需多人共享测试配置，使用团队密钥管理平台，不用仓库文件传递。

### 3.2 CI 配置

CI 使用一次性测试值，不连接生产库。当前 `ci.yml` 已显式提供 `JWT_SECRET`、`DATABASE_URL`、`IP_HASH_SALT`、`CORS_ORIGIN`，并移除 `SKIP_ENV_VALIDATION`。CI 不得使用 `continue-on-error` 掩盖失败。

## 四、Kubernetes Secret 设计

### 4.1 注入关系

`infra/k8s/deployment.yaml` 已为 `DATABASE_URL`、`JWT_SECRET`、`CSRF_SECRET`、`IP_HASH_SALT`、`CORS_ORIGIN` 配置必填 `secretKeyRef`；为 Upstash Redis 两项配置可选 `secretKeyRef`。Secret 名称固定为 `yyc-smart-office-secrets`，命名空间 `yyc`。

### 4.2 创建或更新 Secret（不写入真实值）

```bash
# 变量由受控环境或密钥管理器注入到当前 shell，禁止写入脚本文件
kubectl -n yyc create secret generic yyc-smart-office-secrets \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=CSRF_SECRET="$CSRF_SECRET" \
  --from-literal=IP_HASH_SALT="$IP_HASH_SALT" \
  --from-literal=CORS_ORIGIN="$CORS_ORIGIN" \
  --from-literal=UPSTASH_REDIS_REST_URL="$UPSTASH_REDIS_REST_URL" \
  --from-literal=UPSTASH_REDIS_REST_TOKEN="$UPSTASH_REDIS_REST_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -
```

若团队已有 Sealed Secret、Vault Agent 或云 KM，应改用既有方案；具体托管方式待确认（C-07）。`--dry-run=client` 仅生成对象，不把真实值写入本地文件。

已提供受控脚本 `scripts/k8s-secrets.mjs`，推荐用法：

```bash
# 安全验证，不修改集群
DATABASE_URL=... JWT_SECRET=... CSRF_SECRET=... IP_HASH_SALT=... CORS_ORIGIN=... \
  node scripts/k8s-secrets.mjs apply --context <prod-context> --dry-run

# 生产执行（显式 context，值仅来自环境变量）
node scripts/k8s-secrets.mjs apply --context <prod-context>

# 验证 Deployment 引用并可选检查 rollout
node scripts/k8s-secrets.mjs verify --context <prod-context> --rollout
```

脚本拒绝在无 `--context` 时 apply，且不会把 Secret 值写入文件。

### 4.3 验证命令

```bash
kubectl -n yyc get deployment yyc-smart-office -o jsonpath='{.spec.template.spec.containers[0].env}' | jq
kubectl -n yyc rollout status deployment/yyc-smart-office --timeout=300s
curl -fsS https://<生产域名>/api/health
```

`<生产域名>` 必须由运维提供，不得使用占位域名直接访问生产。

## 五、容灾与回滚

| 场景 | 处理 | 说明 |
| ---- | ---- | ---- |
| Secret 缺失或键名错误 | Pod 启动失败，不回退默认值 | 通过 `kubectl describe pod` 查看 MissingKey 事件 |
| 新版本启动后健康检查失败 | `kubectl -n yyc rollout undo deployment/yyc-smart-office` | Deployment 已保留 5 个 revision |
| 数据库不可用 | 登录接口返回 503，其他只读健康检查报告失败 | 不启用本地账号回退 |
| Redis 不可用 | CSRF 降级为内存存储并需告警 | 多副本场景需尽快恢复 Redis，避免状态不一致 |
| 配置误更新 | 从受控密钥管理平台恢复上一版 Secret 并重启 Deployment | 具体平台待确认（C-07） |
| 数据库误写 | 依赖 PG 备份点恢复；RPO/RTO 待确认（C-03） | 禁止在未确认备份前执行破坏性操作 |

## 六、验收标准

- [ ] `git grep` 无法找到真实口令、Token、Tailscale IP 与生产密钥。
- [ ] 本地复制 `.env.example` 后可填写占位符并启动，不再报「文件不存在」。
- [ ] K8s Deployment 中所有必填环境变量均来自 Secret，且 Secret 存在。
- [ ] 删除任一必填环境变量后应用 fail-fast，不使用默认值。
- [ ] `/api/health` 返回 200，登录接口在缺 DB 时返回 503 且不回退本地账号。
- [ ] 回滚演练成功，且不需要修改代码或跳过安全钩子。

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0.0 | 2026-11-18 | 完成环境变量矩阵、Secret 注入、容灾与回滚设计 | YYC³ Team |

---

<p align="center">
  <b>YYC³</b>（YanYuCloudCube™ · 注册商标）<br>
  言启象限 | 语枢未来<br>
  <i>Words Initiate Quadrants, Language Serves as Core for Future</i><br>
  万象归元于云枢 | 深栈智启新纪元<br>
  <i>All things converge in cloud pivot; Deep stacks ignite a new era of intelligence</i><br>
  <sub>© 2026 YanYuCloudCube™（YYC³）· <a href="mailto:admin@0379.email">admin@0379.email</a></sub>
</p>

---
file: YYC3-整改设计-认证安全与代码质量加固方案.md
title: YYC³ Smart-Office 整改设计 — 认证安全与代码质量加固方案
description: 认证链路、日志脱敏、依赖升级与代码边界加固设计
author: YYC³ Team <admin@0379.email>
version: v1.0.0
created: 2026-11-18
updated: 2026-11-18
status: stable
tags: [security, authentication, code-quality, design]
category: design
language: zh-CN
audience: developers,managers,stakeholders
complexity: advanced
project: yyc3-smart-office
phase: development
review_status: reviewed
---

# YYC³ Smart-Office 整改设计 — 认证安全与代码质量加固方案

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

## 一、已落地的安全加固

| 项目 | 原状态 | 已实施变更 | 复测 |
| ---- | ---- | ---- | ---- |
| 数据库连接 | 内置 `postgres:password` 默认口令 | `lib/db.ts` 移除默认值，缺 `DATABASE_URL` 抛出明确错误 | `pnpm typecheck` 通过；缺配置用例待补 |
| 登录回退账号 | 三个硬编码 bcrypt 哈希，DB 异常时开发模式回退 | `app/api/auth/login/route.ts` 删除回退数组；DB 异常记录日志并返回 503 | 8 个测试套件仍通过 |
| IP 哈希盐 | 默认 `default_salt` | 改为 `IP_HASH_SALT` 必填，缺失即抛错 | 缺配置用例待补 |
| 模拟凭据校验 | `lib/auth.ts` 中 `passwordMatch = true` | 删除整个模拟函数，凭据校验统一走数据库 + `verifyPassword` | 检索确认无调用方 |
| 生产 CORS | 硬编码 `https://smart-office.yyc3.vip` | 改为 `CORS_ORIGIN` 环境变量，生产缺失时生成响应头阶段报错 | lint/typecheck 通过；构建需复核 |
| 质量门禁 | CI `continue-on-error: true` | 移除绕过开关，新增 `pnpm typecheck` 与 `pnpm run audit` | CI 当前因真实问题红灯，符合预期 |

## 二、认证链路加固设计

### 2.1 目标链路

1. 客户端取得 CSRF 双令牌。
2. 登录请求经 Zod 校验、输入净化、验证码比对、CSRF 校验。
3. 服务端用 `IP_HASH_SALT` 对 IP 做哈希后执行限流。
4. 仅查询数据库获取用户，`verifyPassword` 比较 bcrypt 哈希。
5. 成功后签发 JWT，写入 httpOnly/secure/sameSite=strict Cookie。
6. 所有受保护 API 必须使用 `verifyToken` 做签名与过期校验。

### 2.2 失败语义

| 失败类型 | HTTP 状态 | 响应要求 |
| ---- | ---- | ---- |
| 参数校验失败 | 400 | 返回字段级错误，不泄露堆栈 |
| 验证码/CSRF 失败 | 400/403 | 不执行登录，不签发 token |
| 用户不存在/密码错误 | 401 | 统一文案，避免用户枚举 |
| DB 不可用 | 503 | 不回退任何本地账号 |
| 配置缺失 | 500 | 日志给出配置名，不给出值 |
| 限流触发 | 429 | 返回剩余等待时间 |

### 2.3 待确认的鉴权覆盖

`middleware.ts` 在 Edge 仅做 JWT 载荷解码，真正签名校验在 Node API 路由。必须逐个核实所有 `app/api/**/route.ts` 是否调用 `verifyToken` 或等价校验；未覆盖路由视为 P1 风险，不因有全局中间件而判定安全。

## 三、日志与敏感信息脱敏

### 3.1 现状

`lib/logger.ts:25` 与 `:36` 直接 `JSON.stringify(data)`；登录、CSRF 等调用方会传入 IP、用户名、错误上下文。当前未见字段遮蔽逻辑。

### 3.2 设计方案

- 在 Logger 入口增加统一 `redact()` 递归函数。
- 敏感键名至少覆盖：`password`、`token`、`accessToken`、`refreshToken`、`authorization`、`cookie`、`csrfToken`、`secret`、`apiKey`、`DATABASE_URL`、`JWT_SECRET`。
- 对长字符串仅保留前缀与长度摘要，例如 `sk-…(len=32)`，不输出中间内容。
- IP 与邮箱按合规要求决定是否哈希或掩码；未确认前采用保守掩码。
- DB 写失败时，降级文件日志也必须写入脱敏后的 `originalData`。
- 增加 `lib/logger.test.ts`，断言任何敏感字段均不出现在输出中。

## 四、依赖漏洞升级策略

### 4.1 审计事实

`pnpm run audit --prod --audit-level=high --config.registry=https://registry.npmjs.org` 返回 49 个漏洞：3 critical、26 high、18 moderate、2 low。审计输出明确包含 Next.js `<15.5.24` 的 critical  advisory，以及 zod、picomatch 等条目。

### 4.2 处置顺序

1. **Next.js**：将 `next` 与 `overrides.next` 同步升级到官方修复版本 `15.5.24` 或更高；升级后必须复跑 lint/typecheck/test/build。
2. **zod**：审计报告指向 `>=4.6.6` 修复，但属于主版本变更；先做兼容性评估与回归测试，不在未评估前直接替换。
3. **picomatch 等传递依赖**：通过 `pnpm.overrides` 精确调整前需验证上游兼容；不手动修改 lockfile。
4. **审计门禁**：保持 `pnpm run audit` 严格失败。若需要临时风险接受，必须由责任人书面签署，且不得通过降低 `--audit-level` 掩盖。

> 本报告只引用审计输出中出现的版本与 advisory，不编造补丁版本；`patched versions` 显示为异常值的条目按「待确认」处理。

## 五、代码质量与模块边界

### 5.1 目录与依赖

- 保持现有 Next.js 平铺结构，不强行改成 `src/app` 或 Vite 结构；团队标规差异作为架构决策记录。
- 将 `lib/api-client.ts` 中对 `hooks/use-csrf` 的依赖改为注入式接口或把纯 token 读取工具下沉到 `lib/csrf-client.ts`，消除 lib→hooks 反向依赖。
- 新增模块时遵循 `app → components/hooks/contexts → lib → middleware/models` 单向原则。

### 5.2 标头与测试

- 新改核心文件逐步补齐团队 JSDoc 标头；本次优先保证功能与安全，不做全仓批量重写。
- 清理 7 项 skipped 测试：确认有效则恢复，确认废弃则删除并说明理由。
- 为 `lib/db.ts`、`lib/auth.ts`、登录路由补反向测试，确保 fail-fast 与 503 语义不回归。

### 5.3 工具链

- `next lint` 已弃用，后续迁移到 ESLint CLI，并保留 Next 配置兼容性。
- pre-commit 在格式化之外增加密钥扫描与 `pnpm typecheck`；具体扫描工具需团队确认后引入，不编造未安装的工具。

## 六、验收标准

- [ ] 所有 API 路由鉴权覆盖清单完成，未覆盖项为 0 或已签字豁免。
- [ ] Logger 脱敏测试通过，敏感字段明文输出为 0。
- [ ] Next.js critical 漏洞清零，高危项有处置或书面风险接受。
- [ ] `lib` 不再引用 `hooks`，依赖图无环。
- [ ] 新增核心反向测试全部通过，skipped 项有明确结论。

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0.0 | 2026-11-18 | 完成认证、日志、依赖与模块边界加固设计 | YYC³ Team |

---

<p align="center">
  <b>YYC³</b>（YanYuCloudCube™ · 注册商标）<br>
  言启象限 | 语枢未来<br>
  <i>Words Initiate Quadrants, Language Serves as Core for Future</i><br>
  万象归元于云枢 | 深栈智启新纪元<br>
  <i>All things converge in cloud pivot; Deep stacks ignite a new era of intelligence</i><br>
  <sub>© 2026 YanYuCloudCube™（YYC³）· <a href="mailto:admin@0379.email">admin@0379.email</a></sub>
</p>

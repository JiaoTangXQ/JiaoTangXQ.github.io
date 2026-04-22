---
title: "devUserId 只在本地 bridge 里存在：开发便利关在围栏里"
slug: "12-07-08-bridgedevuserid"
date: 2026-04-09
topics: [外延执行]
importance: 1
---

# devUserId 只在本地 bridge 里存在：开发便利关在围栏里

```typescript
const bridgeConfig = isLocalBridge()
  ? { ...baseBridgeConfig, devUserId: 'dev_user_local' }
  : baseBridgeConfig;
```

`devUserId` 只在本地 bridge 模式下才被注入，其他所有路径都不带这个字段。

## 为什么需要 devUserId

在本地开发时，工程师需要能快速测试 bridge 功能，不想每次都走完整的 OAuth 流程来建立真实身份。`devUserId: 'dev_user_local'` 提供了一个固定的假身份，让本地测试可以跑起来，而不需要真实账号。

## 为什么它不能泄漏到生产

Bridge 系统连接的是真实的浏览器扩展和真实的用户账号。如果 `devUserId` 这样的假身份出现在生产路径里：

1. 真实用户可能被系统误认为是「开发测试用户」，触发错误的行为
2. 真实的遥测和分析数据会被「dev_user_local」污染，指标失真
3. 如果有按用户身份做的权限检查，假身份可能绕过或触发错误的权限

`isLocalBridge()` 条件确保这个假身份只在真正的本地开发环境里存在。一旦连的是任何真实的 bridge（staging 或生产），这个字段就不再注入。

## 开发便利和生产安全的隔离模式

这类「只在本地有的辅助配置」在工程里很常见：测试 token、fake API 响应、跳过验证的标志……每一个都是为了让本地开发更流畅而存在的，但每一个也都是潜在的生产污染源。

用代码显式隔离（`isLocalBridge()` 条件），比靠注释提醒（「注意：不要在生产里用这个」）可靠得多。条件检查会强制执行，注释不会。

---
title: “policySettings 凭什么覆盖 userSettings？settings 来源的权力等级”
slug: "06-07-01-settings"
date: 2026-04-09
topics: [治理与权限]
summary: “Claude Code 的五层 settings 来源为什么不是平等的？policySettings 的管理员特权从哪来？allowManagedPermissionRulesOnly 如何锁定用户的自定义能力？”
importance: 1
---

# policySettings 凭什么覆盖 userSettings？settings 来源的权力等级

面试官追问：”你说 policySettings 可以锁定其他来源的规则。它的权威性从哪里来？用户能绕过它吗？”

## 五层来源的权力结构

`SETTING_SOURCES` 的排列顺序不是随机的：

```typescript
// settings/constants.ts
export const SETTING_SOURCES = [
  'userSettings',     // ~/.claude/settings.json
  'projectSettings',  // ./.claude.json
  'localSettings',    // ./.claude.local.json（git ignored）
  'policySettings',   // MDM/企业管控，或 managed-settings.d/ 目录
  'flagSettings',     // CLI --flag-settings 参数指定的文件
] as const
```

在合并设置时，**后出现的来源优先级更高**。`policySettings` 排在 `projectSettings` 后面，所以企业管理员的设置能覆盖项目设置。`flagSettings` 排在最后，CLI 传入的临时配置优先级最高。

但”合并时优先”和”锁定其他来源”是两个不同的概念。

## policySettings 的专属锁定能力

`policySettings` 不只是优先级高，它还有几个专属的配置键，能主动锁定其他来源：

**锁定权限规则**：
```typescript
// permissionsLoader.ts
export function shouldAllowManagedPermissionRulesOnly(): boolean {
  return (
    getSettingsForSource('policySettings')?.allowManagedPermissionRulesOnly === true
  )
}
```

当 `allowManagedPermissionRulesOnly` 为 true 时，只有 policySettings 里的权限规则生效，用户在 `userSettings` 或 `projectSettings` 里写的 allow/deny 规则全部被忽略。

**锁定 hooks**：
```typescript
// hooksConfigSnapshot.ts
if (policySettings?.allowManagedHooksOnly === true) {
  return policySettings.hooks ?? {}  // 只返回管理员配置的 hooks
}
if (policySettings?.disableAllHooks === true) {
  return {}  // 完全禁用所有 hooks
}
```

如果管理员在 policySettings 里设了 `allowManagedHooksOnly: true`，用户配置的所有 hooks 被忽略。如果设了 `disableAllHooks: true`，连管理员自己的 hooks 都禁掉了。

## policySettings 的物理来源

policySettings 来自两个途径：

1. **MDM（Mobile Device Management）**：企业设备管理系统，通过注册表（Windows）或 plist（macOS）写入的配置。`getMdmSettings()` 读取这些数据。
2. **managed-settings.d/ 目录**：`~/.claude/managed-settings.d/` 下的任意 `.json` 文件，每个文件都是一个策略片段，会被合并。

MDM 设置是操作系统级的，普通用户进程无法覆盖。这是 policySettings 权威性的物理基础——它不是”另一个配置文件”，而是可能来自操作系统的权限边界。

## pluginOnlyPolicy：第三种锁定机制

```typescript
// settings/pluginOnlyPolicy.ts
export function isRestrictedToPluginOnly(capability: string): boolean {
  // 检查 policySettings 是否开启了 strictPluginOnlyCustomization
  // ...
}
```

`strictPluginOnlyCustomization` 是一个更精细的锁定：它不是完全禁用用户自定义，而是只允许通过”插件”渠道来扩展——比如 MCP server 注册的 hooks，而不是用户手写的 hooks 配置。

这个设计的考量是：插件有独立的审核和信任流程，而用户自定义的 hooks 是任意脚本。企业环境可能想允许前者但限制后者。

## 用户能绕过 policySettings 吗

理论上，用户可以：
1. 直接修改 MDM 写入的注册表/plist（但企业设备通常限制这个权限）
2. 用 `flagSettings` 传入一个覆盖配置（`flagSettings` 排在 policySettings 之后，优先级更高）

但 `flagSettings` 的使用场景是临时调试，不是持久设置。而且企业环境通常会在 MDM 层面限制 CLI 参数的使用。

更重要的是：Claude Code 读取 policySettings 时使用 `checkSecurityRestrictionGate` 来验证某些安全限制是否来自受信任的管理者渠道。这让”伪造 policySettings”变得更难。

## 这道题考什么

考察对 settings 权力结构的理解，不只是”优先级高低”，而是”锁定机制”。

表层答案：policySettings 优先级高，所以能覆盖。

深层答案：policySettings 有三种专属锁定机制（`allowManagedPermissionRulesOnly`、`allowManagedHooksOnly`、`disableAllHooks`），它们不是靠优先级覆盖，而是主动忽略其他来源。物理上，MDM 设置来自操作系统级，不是普通文件，这是权威性的根基。

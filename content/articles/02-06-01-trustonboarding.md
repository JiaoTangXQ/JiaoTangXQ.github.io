---
title: "checkHasTrustDialogAccepted() 这个函数名里藏着什么设计信息？"
slug: "02-06-01-trustonboarding"
date: 2026-04-09
topics: [工作台架构, 启动]
importance: 1
---

# checkHasTrustDialogAccepted() 这个函数名里藏着什么设计信息？

## 名字即文档

Claude Code 在 `prefetchSystemContextIfSafe()` 里：

```typescript
function prefetchSystemContextIfSafe(): void {
  const isNonInteractiveSession = getIsNonInteractiveSession();
  if (isNonInteractiveSession) {
    void getSystemContext();
    return;
  }
  
  const hasTrust = checkHasTrustDialogAccepted();
  if (hasTrust) {
    void getSystemContext();
  }
}
```

函数名是 `checkHasTrustDialogAccepted`，不是 `isUserTrusted()`、`hasPermission()` 或 `isTrustedDirectory()`。

这个命名的精确性很值得分析。

## "Dialog Accepted" vs "Trusted"

`checkHasTrustDialogAccepted()` 的含义：这台机器上的用户是否曾经明确接受过 trust dialog。

如果叫 `isUserTrusted()`，会暗示这是在判断"某个用户是否可信"——这是错误的语义，trust 不针对用户，而是针对"系统状态"（是否已经完成了 trust 确认流程）。

如果叫 `hasPermission()`，会和具体的操作权限混淆——Claude Code 有一套独立的 permission 系统（auto mode、bypass 等），trust 是更上层的"能进入完整能力世界"的开关。

如果叫 `isTrustedDirectory()`，会暗示这是针对特定目录的信任——但实际上 `checkHasTrustDialogAccepted()` 检查的是全局状态（用户是否在全局配置里记录了"已接受"）。

"Dialog Accepted" 精确描述了：这是一个"用户有没有经历过那个对话框并点击接受"的状态检查，而不是更宽泛的信任判断。

## Trust 状态存在哪里？

```typescript
// config.ts（大致逻辑）
export function checkHasTrustDialogAccepted(): boolean {
  return getGlobalConfig().hasTrustDialogAccepted === true;
}
```

这个状态存在 `~/.claude/settings.json` 的全局配置里，是持久化的、跨会话的状态。

一旦用户接受了 trust dialog，后续启动不需要再次确认（除非配置被重置）。这是一个合理的 UX 决策——每次启动都要重新确认信任，用户体验会很差；但完全没有信任确认，安全性又不够。

`prefetchSystemContextIfSafe()` 里用这个状态来决定是否可以提前执行 git 命令——如果用户曾经明确确认过 trust，就认为在这台机器上的使用是安全的。

## Trust 的多个层次

Claude Code 里有多个层次的"信任"判断，它们有不同的含义：

**1. `checkHasTrustDialogAccepted()`**：全局持久化的"已完成首次信任确认"状态。

**2. `getIsNonInteractiveSession()`**：会话级别的"这次是自动化调用，默认信任"判断。

**3. Permission mode**（`auto`、`default`、`bypass`等）：操作级别的"这类操作需要多大程度的用户确认"。

**4. MCP server trust**：每个 MCP 服务器的独立信任状态（是否允许这个工具运行）。

这四个层次是叠加的，不相互替代。即使 `checkHasTrustDialogAccepted()` 为 true，某个危险操作仍然可能需要额外确认（取决于 permission mode）。

## showSetupScreens() 里的 trust 序列

```typescript
// 源码里的 showSetupScreens()（简化）
async function showSetupScreens(...) {
  // onboarding 先
  if (shouldShowOnboarding()) {
    await showOnboardingScreen();
  }
  
  // trust 是独立的闸门
  if (!checkHasTrustDialogAccepted()) {
    const accepted = await showTrustDialog();
    if (!accepted) {
      await gracefulShutdown(0);
      return;
    }
    // 记录已接受
    saveGlobalConfig(prev => ({...prev, hasTrustDialogAccepted: true}));
  }
  
  // trust 通过后才做的事情
  initializeTelemetryAfterTrust();
  void getSystemContext();
  // ...
}
```

注意 `if (!checkHasTrustDialogAccepted())` 包裹的是 trust dialog 的显示——如果已经接受过，跳过这段，直接执行 trust 通过后的操作。

也就是说：`checkHasTrustDialogAccepted() === true` 不表示"跳过所有 trust 相关逻辑"，而是"跳过 trust 确认界面，但仍然执行只有 trust 通过后才能做的初始化操作"。

函数名 `checkHasTrustDialogAccepted` 准确地只代表了"是否曾经接受过对话框"这一层含义，不涉及后续的能力解锁逻辑。

## 面试指导

函数命名看起来是小事，但在安全相关代码里，命名准确性很重要。

评估命名的标准：
1. **含义精确**：不包含额外的语义（`isTrustedDirectory` 比实际函数做的事情更多）
2. **范围清晰**：是全局状态、会话状态还是操作状态？（`checkHasTrustDialogAccepted` 是全局持久化的）
3. **不与其他概念混淆**：和 permission、role、capability 等概念有明确区分

在代码 review 里指出"这个函数名不准确，可能导致误用"，是展示对代码质量有高要求的好方式。特别是安全相关代码，命名混淆可能导致开发者错误地使用某个信任检查来替代另一个，造成安全漏洞。

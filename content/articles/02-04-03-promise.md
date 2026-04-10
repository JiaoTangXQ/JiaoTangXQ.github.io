---
title: >-
  init() 里为什么要"建立 Promise"而不是直接等待结果？
slug: "02-04-03-promise"
date: 2026-04-09
topics: [工作台架构, 启动]
summary: "Claude Code 在 init() 里调用 initializeRemoteManagedSettingsLoadingPromise() 和 initializePolicyLimitsLoadingPromise()——这两个函数只是建立 Promise，不等待结果。这种模式解决了什么问题？"
importance: 1
---

# init() 里为什么要"建立 Promise"而不是直接等待结果？

## 两行耐人寻味的代码

```typescript
// entrypoints/init.ts
if (isEligibleForRemoteManagedSettings()) {
  initializeRemoteManagedSettingsLoadingPromise()
}
if (isPolicyLimitsEligible()) {
  initializePolicyLimitsLoadingPromise()
}
profileCheckpoint('init_after_remote_settings_check')
```

这里不是 `await loadRemoteManagedSettings()`，而是 `initializeRemoteManagedSettingsLoadingPromise()`——初始化一个加载 Promise，然后继续，不等结果。

为什么？

## 问题：有些数据需要，但无法确定什么时候需要

远端受管设置（Remote Managed Settings）是企业管理员通过服务端配置下发到客户端的设置项。它们可能影响：
- 哪些功能允许使用
- 哪些模型可以选择
- 权限默认值是什么

这些设置在很多地方都可能被消费，但消费时机各不相同：
- 某些在 `showSetupScreens()` 期间
- 某些在 REPL 首次渲染时
- 某些在第一次 API 调用时
- 甚至某些在首屏之后的某个用户操作时

如果在 `init()` 里 `await` 等待加载完成，就把这个等待时间放在了所有会话的关键路径上——即使很多会话不需要这些设置、或者在很久之后才需要。

## 解决方案：Promise 提前启动，使用时收口

```typescript
// 某个配置文件里（简化）
let remoteManagedSettingsLoadingPromise: Promise<void> | null = null;

export function initializeRemoteManagedSettingsLoadingPromise(): void {
  remoteManagedSettingsLoadingPromise = doLoadRemoteManagedSettings();
  // 不 await，让它在后台跑
}

export async function waitForRemoteManagedSettingsToLoad(): Promise<void> {
  if (remoteManagedSettingsLoadingPromise) {
    await remoteManagedSettingsLoadingPromise;
  }
  // 如果 promise 没有建立，立即返回（可能是不需要等待的场景）
}
```

在 `init()` 里，Promise 在发现"有资格使用远端设置"时立即启动。但 `init()` 本身不等待。

在需要远端设置的地方，调用 `waitForRemoteManagedSettingsToLoad()`：

```typescript
// initializeTelemetryAfterTrust() 里
void waitForRemoteManagedSettingsToLoad()
  .then(async () => {
    applyConfigEnvironmentVariables()
    await doInitializeTelemetry()
  })
```

这样：
- 远端设置请求在 `init()` 阶段就发出了（最早可能的时机）
- `init()` 不被这个网络请求阻塞
- 真正需要这些设置的代码，await 时大概率已经完成（等待时间被"提前藏"进了其他工作里）

## 超时保护

注释里提到了一个重要细节：

```typescript
// Initialize the loading promise early so that other systems (like plugin hooks)
// can await remote settings loading. The promise includes a timeout to prevent
// deadlocks if loadRemoteManagedSettings() is never called (e.g., Agent SDK tests).
```

这个 Promise 有超时机制——如果远端设置在一定时间内没有加载完成（网络问题、服务端超时），promise 会 resolve 而不是永久悬挂。

这防止了一类经典的死锁场景：某个代码路径 `await waitForRemoteManagedSettingsToLoad()`，但在该路径里 `loadRemoteManagedSettings()` 从来没有被调用（比如测试环境、Agent SDK 直接使用等场景）。没有超时的话，这里会永远等待。

## API 预连接的类似模式

```typescript
// 注释说明了同样的思路
preconnectAnthropicApi()
```

`preconnectAnthropicApi()` 启动 TCP+TLS 预热，但不 await 结果。真正发 API 请求时，如果预热已经完成，连接可以复用；如果还没完成，正常建立新连接。

这是"火-忘-收口"模式的经典应用：
1. 启动（fire）
2. 不等待（forget）
3. 在需要结果的地方等待（收口）

这个模式的精妙在于：如果结果在需要时已经就绪，等待时间为零；如果没就绪，才真正等待剩余时间。最坏情况与"不提前启动"一样，最好情况大幅改善。

## 面试指导

"提前启动但不等待"是异步编程里一个非常实用但容易被忽视的模式。

**简单版**：`Promise.all([a(), b(), c()])` — 并行启动多个异步操作，等所有完成。

**更进阶版**（Claude Code 的做法）：
- 在最早可能的时机启动 Promise
- 不在启动处等待
- 在真正需要结果的地方等待

区别在于：并行启动是"知道这些操作都需要，一起启动"；提前启动是"不确定是否需要、什么时候需要，但几乎肯定会需要，所以尽早启动"。

面试时能区分这两个模式，并说出"提前启动减少的是等待时间的上界，最坏情况不会更差"，是对异步模式有深度理解的体现。

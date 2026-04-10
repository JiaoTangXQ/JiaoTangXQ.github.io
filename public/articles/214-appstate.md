---
title: "AppState 是如何成为跨子系统事实的唯一落点的？"
slug: "214-appstate"
date: 2026-04-09
topics: [Claude Code 源码, AppState, 状态管理]
summary: "Claude Code 的 AppState 不是一个普通的全局变量，而是跨子系统事实必须先汇聚的共同世界。bootstrap/state.ts 里的 State 类型承载了 cwd、modelUsage、toolPermissionContext 等几十个字段，DisplayLayer 只从这里读数据。拆解 AppState 为何这么设计、它替代了什么。"
importance: 0.9
---

# AppState 是如何成为跨子系统事实的唯一落点的？

## 面试场景

面试官问：「你们系统里状态管理怎么做的？工具执行的结果、模型的开销、当前工作目录——这些分别放在哪里，UI 怎么读到它们？」

很多人的第一反应是：「各个组件自己管自己的状态，需要共享的用 context 传一传。」

Claude Code 的答案不一样。

## bootstrap/state.ts 里的 State 类型

`src/bootstrap/state.ts` 定义了一个叫 `State` 的类型，注释里明确写着：

```
// DO NOT ADD MORE STATE HERE - BE JUDICIOUS WITH GLOBAL STATE
```

这条注释本身就是答案的一部分——AppState 是刻意被收窄的，不是随意扩张的全局变量池。

State 里承载的字段横跨多个子系统：

```typescript
type State = {
  originalCwd: string
  projectRoot: string
  totalCostUSD: number
  totalAPIDuration: number
  cwd: string
  modelUsage: { [modelName: string]: ModelUsage }
  mainLoopModelOverride: ModelSetting | undefined
  isInteractive: boolean
  // ... 几十个字段
}
```

这些字段从 `cwd`（运行时工作目录）到 `modelUsage`（按模型名统计的 API 用量），再到 `isInteractive`（当前是否在交互模式），覆盖了主循环、工具执行、会话管理等完全不同的子系统。

## 为什么不分开放？

最直觉的做法是各个子系统保留自己的状态：工具模块自己记工具执行次数，API 模块自己记费用，UI 组件各自订阅需要的事件。

这条路在单一功能时很清爽，但会在长会话里出问题：

**问题一：时序不一致**。当用户切换了工作目录，工具模块还没收到通知，API 模块已经用旧路径发了请求。状态散落时，「谁先更新」成了一个需要额外协调的问题。

**问题二：UI 漂移**。显示层如果订阅多个不同来源的状态，某一时刻可能看到 A 子系统是新状态、B 子系统还是旧状态——显示的是一个不存在的中间态。

**问题三：resume 无法还原**。会话中断后恢复，必须能重建一个和中断时一致的世界。如果状态散在各处，重建就变成了「把每个子系统挨个恢复，祈祷顺序正确」。

## AppState 的统一作用

AppState 解决上述问题的方式很直接：**让所有跨子系统的事实只写入一个地方**。

`getAppState()` 是读取当前 AppState 的入口，`toolUseContext.getAppState()` 是工具执行时访问它的方式。当 hook 执行需要读权限模式时：

```typescript
const appState = toolUseContext.getAppState()
const permissionMode = appState.toolPermissionContext.mode
```

这里没有「向 permission 服务查询」，没有「等一个 promise」，也没有「从 context 里订阅」——就是直接读 AppState 里的字段。

显示层也是同理。Status line 展示的 `totalCostUSD`、`turnCount`、`cwd`，都来自同一个 AppState 快照。这保证了某一刻的显示是一个自洽的整体，不是几个异步来源拼出来的碎片。

## 字段的「跨子系统性」才是关键

AppState 不是把所有状态都塞进来。注释「BE JUDICIOUS WITH GLOBAL STATE」说的就是：只有真正需要被多个子系统同时看到的事实，才应该进 AppState。

`modelUsage` 之所以在 AppState 里，是因为 API 模块更新它、UI 的 cost 组件读它、会话结束时的统计也用它——三个不同地方需要看同一个数字。

`turnCount` 之所以在 AppState 里，是因为 maxTurns 检测需要它、日志需要它、stop hook 的判断也可能依赖它。

如果把它们散到各自归属的模块里，这些交叉读写就变成了隐式依赖，最终在某个角落出现「我以为你更新了但你没更新」的 bug。

## AppState 与 transition 的关系

AppState 是静态快照，`State.transition` 是动态方向。

query 循环里，每一轮迭代都会读 AppState 来决定当前的权限模式、模型配置、工作目录，然后根据执行结果决定 `transition.reason`——是 `next_turn`、`collapse_drain_retry` 还是 `stop_hook_blocking`。

AppState 提供「现在是什么」，transition 提供「下一步为什么这样走」。没有前者，后者就缺少判断依据。

## 面试指导

「你们怎么管理全局状态」这个问题，背后真正在问的是：**你们怎么保证多个子系统看到的是同一个现实，而不是各自眼里的碎片**。

Claude Code 的答案是：刻意创造一个共同世界（AppState），让所有跨子系统的事实都先汇入这里，再由显示层读取统一快照。

代价是 AppState 字段会随系统演进而增长，「BE JUDICIOUS」这条注释是防止它变成无边界垃圾桶的约束。

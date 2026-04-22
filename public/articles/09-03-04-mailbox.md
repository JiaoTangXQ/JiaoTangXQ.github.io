---
title: "权限请求的两条路：leader UI 桥和 mailbox 退路，哪条应该是主路？"
slug: "09-03-04-mailbox"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# 权限请求的两条路：leader UI 桥和 mailbox 退路，哪条应该是主路？

in-process teammate 需要用户批准一个工具调用时，它有两条路可以走：

**路径 A**：通过 `leaderPermissionBridge`，直接把请求推进 leader React 状态的 `ToolUseConfirm` 队列，立刻触发 UI 更新。

**路径 B**：走 `permissionSync.ts`，把请求写进 `permissions/pending` 目录，等 leader 的轮询器发现并处理，再从 `permissions/resolved` 读结果。

Claude Code 的选择：**A 优先，A 不可用时用 B**。

## 路径 A 为什么更快

直接推进 React 状态，不需要文件 I/O，不需要轮询等待，不需要序列化/反序列化。从 worker 发出请求到 leader UI 显示弹窗，只有一个函数调用的延迟。

```typescript
const setQueue = getLeaderToolUseConfirmQueue()
if (setQueue) {
  // 直接更新 React 状态
  setQueue(prev => [...prev, newConfirmRequest])
  // leader UI 会在下一帧渲染时显示弹窗
}
```

对用户体验来说，这意味着 worker 请求权限后，leader 界面几乎是瞬时响应的，没有轮询延迟。

## 路径 B 为什么必须存在

路径 B 的存在，是为了处理路径 A 不可用的场景。什么时候路径 A 不可用？

**leader 桥未注册**：`leaderPermissionBridge` 是由 React REPL 组件在挂载时注册的。如果 leader 的 React 界面还没挂载，或者已经卸载，桥就不存在。

**headless 模式**：Claude Code 有一个非交互的 headless 模式，这种模式下没有 React 界面，桥不会被注册。但 headless 模式下的多 agent 协作仍然需要权限协调。

**跨进程场景统一接口**：tmux pane teammate 和 leader 在不同进程，根本没法走路径 A。路径 B 是所有 teammate 类型（in-process 和 pane）都支持的。如果 in-process teammate 完全不实现路径 B，就无法提供一套统一的权限协调接口。

## 回退不是备用轮子

设计这种"主路径 + 回退路径"时，最容易犯的错误是把回退做成"应急备用"——只在紧急情况下用，平时不维护，等真的用到时发现已经坏了。

Claude Code 避免了这个问题，方式是：**两条路径都是被测试和维护的完整实现**，不是一条正路 + 一条废弃备用。路径 B（mailbox 机制）同时被 tmux teammate 使用，所以它是持续运行中的功能，不是积灰的备用代码。

这是多路径设计里一个很重要的工程原则：**让你的回退路径在正常工作流中也被使用**，而不是只在降级时才走。只有被持续使用的代码才会被持续维护，只在故障时用的代码往往在真正需要时已经腐烂了。

## 桥的生命周期

`leaderPermissionBridge.ts` 暴露了对称的注册和注销接口：

```typescript
export function registerLeaderToolUseConfirmQueue(setter: SetToolUseConfirmQueueFn): void
export function unregisterLeaderToolUseConfirmQueue(): void

export function registerLeaderSetToolPermissionContext(setter: SetToolPermissionContextFn): void
export function unregisterLeaderSetToolPermissionContext(): void
```

React REPL 在挂载时注册，在卸载时注销。这防止了 stale closure 问题——如果只注册不注销，下次 REPL 重新挂载时会重复注册，而旧的注册仍然可能指向已经销毁的组件实例。

`getLeaderToolUseConfirmQueue()` 可能返回 `null`，这是系统承认"桥不一定可用"的类型表达。任何调用方都必须处理 `null` 的情况，从而被强制实现回退逻辑。

如果 `getLeaderToolUseConfirmQueue()` 返回的是 always-not-null 的值（比如抛错），调用方就没有机会写回退逻辑，一旦桥不存在就直接崩溃。返回 `null` + 调用方检查，是一种通过类型系统强制要求回退的设计。

## 面试怎么答

如果面试题是"设计一个有主路径和回退路径的系统，你会怎么考虑"：

**常见错误**：回退路径只做接口，不做实现（或者实现非常简陋）。这会让系统在真正需要回退时发现回退路径没法用。

**正确思路**：回退路径必须是一个完整可用的实现，而不是占位符。最好的方式是让回退路径也被其他场景使用，这样它会被持续维护。

**Claude Code 的方式**：路径 B（mailbox 机制）不只是 in-process teammate 的备用，它同时是 tmux teammate 的主路径。因此这条路径会持续被测试和维护，真正用到时一定是工作状态的。

**类型设计**：如果你的快速路径可能不可用，就让它的返回类型包含"不可用"的状态（返回 nullable，或者 Optional/Maybe 类型），而不是假设它一定可用然后在运行时崩溃。后者看起来少写几行检查代码，但实际上是把错误处理的成本推到了崩溃时刻，代价更高。

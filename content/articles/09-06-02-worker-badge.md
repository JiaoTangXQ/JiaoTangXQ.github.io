---
title: "Worker Badge：复用权限弹窗组件但不丢失组织上下文，怎么做到的？"
slug: "09-06-02-worker-badge"
date: 2026-04-09
topics: [多Agent协作]
importance: 1
---

# Worker Badge：复用权限弹窗组件但不丢失组织上下文，怎么做到的？

当 Leader 自己需要权限时，显示的是标准的 `ToolUseConfirm` 弹窗。

当 Worker 通过 Leader 请求权限时，弹窗里额外显示了一个徽标（badge）：成员的名字和颜色。

```
┌─────────────────────────────────────────┐
│ [researcher ●蓝] 请求执行 Bash 命令：    │
│   > grep -r "TODO" ./src               │
│                                        │
│ [批准] [拒绝] [总是允许]                │
└─────────────────────────────────────────┘
```

这个 badge 是怎么实现的？为什么不直接新建一个"worker 专用权限弹窗"？

## ToolUseConfirm 结构的扩展

`ToolUseConfirm` 类型有一个可选的 `workerBadge` 字段：

```typescript
type ToolUseConfirm = {
  toolName: string
  toolUseId: string
  input: Record<string, unknown>
  description: string
  // ...标准字段

  workerBadge?: {
    name: string
    color: string
  }
}
```

`inProcessRunner.ts` 在构造 Worker 的权限请求时，填充这个字段：

```typescript
const confirmRequest: ToolUseConfirm = {
  toolName: request.toolName,
  toolUseId: request.toolUseId,
  input: request.input,
  description: request.description,
  workerBadge: agentContext ? {
    name: agentContext.agentName,
    color: agentContext.color ?? 'grey',
  } : undefined,
}
```

`ToolUseConfirm` 组件在渲染时检查 `workerBadge` 是否存在：存在就渲染 badge，不存在就渲染标准的无 badge 弹窗。

这是一个很经典的"可选装饰"模式——核心组件不变，通过可选字段扩展显示上下文。

## 为什么不做一个专用的 Worker 权限弹窗

"为 Worker 请求单独做一个弹窗组件" 看起来是更干净的分离，但有几个实际问题：

**维护成本翻倍**。权限弹窗的交互逻辑（批准/拒绝/总是允许的状态机、键盘快捷键、确认前的高亮显示）是相当复杂的。如果新建一个 Worker 专用组件，这些逻辑要复制一份。未来如果修改弹窗行为，需要同时修改两个组件。

**用户体验不一致**。Leader 自己的操作和 Worker 的请求，用户习惯了同一套弹窗的操作方式。如果 Worker 请求显示的是完全不同样式的弹窗，用户需要重新理解操作方式，增加认知负担。

**代码路径分叉**。如果 Leader 请求走一条路径，Worker 请求走另一条路径，任何对权限流程的修改都需要在两条路径上同步。这种分叉很快会导致两条路径产生微妙差异，变得难以维护。

通过可选 `workerBadge` 字段，复用了 95% 的代码，只在渲染层做了最小的差异化。

## 颜色不是装饰，是组织认知工具

`workerBadge.color` 对应 Worker 的身份颜色，和 mailbox 消息里的 `color` 字段，和 tmux pane 的边框颜色，用的是同一个值。

这种颜色一致性是刻意的设计。用户在看到 Leader UI 里的权限弹窗时，badge 上的蓝色就是 tmux 窗口里那个蓝色边框的 researcher pane 的颜色。视觉映射是稳定的：**蓝色 = researcher**，无论在哪个界面都是同一个颜色。

这利用了人脑的视觉记忆：颜色比名字更容易被快速识别和记忆。当弹窗出现时，用户看到蓝色 badge，瞬间知道"这是 researcher 的请求"，不需要读名字。

`teammateLayoutManager.ts` 的 `assignTeammateColor()` 函数保证了同一个 teammate 在整个会话里颜色不变：

```typescript
const colorAssignments = new Map<string, AgentColorName>()

export function assignTeammateColor(teammateId: string): AgentColorName {
  const existing = colorAssignments.get(teammateId)
  if (existing) return existing
  // 分配一个还未被使用的颜色
  const newColor = pickNextColor()
  colorAssignments.set(teammateId, newColor)
  return newColor
}
```

颜色一旦分配就稳定，不会在会话中途漂移——这是保证"颜色 = 身份记忆"有效的前提。

## 权限决定的细粒度控制

Badge 的存在还开启了一个功能：**按成员维度设置权限规则**。

当用户在弹窗上选择"总是允许"，系统知道这是哪个 Worker（通过 badge），可以把 always-allow 规则绑定到这个特定 Worker 的上下文，而不是全局生效。

这意味着：允许 `researcher` 总是执行 `grep` 命令，但不代表允许 `code-writer` 也总是执行 `rm` 命令。权限规则可以按成员细分，而不是只能全局允许或全局拒绝。

没有 badge，这个细粒度控制就不存在——弹窗不知道是哪个 Worker，只能做全局决定。

## 面试怎么答

如果面试题是"如何在复用 UI 组件的同时保留上下文差异"：

**常见错误**：为每个场景新建组件，导致大量重复代码；或者组件里堆满 `if-else`，可读性极差。

**正确思路**：识别"核心不变的部分"和"场景相关的可选扩展"，把可选扩展做成明确的可选字段（`workerBadge?: {...}`）。核心组件复用，差异通过可选字段表达。

**Claude Code 的方式**：`ToolUseConfirm` 加 `workerBadge?` 字段。存在就渲染，不存在就渲染默认样式。一个组件，两种场景，零重复代码，零条件分叉。

**延伸思考**：这个模式类似于 HTML 的 `data-*` 自定义属性——核心元素语义不变，额外的上下文通过可选属性携带。好的组件设计应该是"可选地更丰富"，而不是"为每种场景分叉一个版本"。

---
title: "工程取舍：tool_progress 为什么被压成 system message 而不是独立类型？"
slug: "08-06-02-tool-progresssystem-message"
date: 2026-04-09
topics: [远端与边界]
importance: 1
---

# 工程取舍：tool_progress 为什么被压成 system message 而不是独立类型？

## 当类型系统遇到语义差距

在强类型系统里，"两个东西不完全对应"时有三种处理方式：

1. **强行映射**：找一个最接近的目标类型，接受信息损失
2. **引入新类型**：让目标类型集合扩展，保留完整语义
3. **忽略**：不处理这种情况，让它消失

Claude Code 对远端 `tool_progress` 消息选择了第 1 种：强行映射到 `system informational message`。

这个选择背后有具体的工程原因。

## ProgressMessage 为什么不能直接复用？

本地的 `ProgressMessage` 是这样设计的（简化）：

```typescript
type ProgressMessage = {
  type: 'progress'
  toolUseId: string          // 对应本地 tool use 实例的 ID
  toolName: string
  currentStep: number
  totalSteps?: number
  output?: string            // 实时输出流的内容
  // ... 其他本地工具执行上下文字段
}
```

`toolUseId` 是关键：它指向本地进程中正在执行的工具实例。本地的进度渲染组件会订阅这个 ID 对应的输出流，实时更新 UI。

问题：**远端工具在 CCR 容器里执行，这个 `toolUseId` 在本地根本不存在**。本地没有对应的工具实例，没有输出流，没有可以订阅的东西。

如果强行用 `ProgressMessage` 类型，要么：
- 带着一个无效的 `toolUseId`（本地查不到对应实例，渲染失败或显示空白）
- 或者为远端情况特殊处理 `ProgressMessage`（渲染组件变成了 if/else 判断本地 vs 远端）

两种结果都更差。

## system message 的优势

`system informational message` 是本地消息体系里最简单的类型：

```typescript
type SystemMessage = {
  type: 'system'
  subtype: 'info' | 'warning' | 'error' | 'suggestion'
  content: string    // 纯文本，没有结构化字段
}
```

把 `tool_progress` 的进度文本放进 `content`，转成 `system info` 消息，它就能：

- 进入现有消息列表渲染
- 被历史搜索索引
- 被分割线、分页逻辑正常处理
- 在 viewerOnly 模式里正确显示

没有任何现有代码需要特殊处理"这是一条来自远端进度的系统消息"。它和所有其他 system info 消息完全一样。

## 引入新类型的成本

假设反过来，选择引入一个 `RemoteProgressMessage` 类型：

```typescript
type RemoteProgressMessage = {
  type: 'remote_progress'
  toolName: string
  progressText: string
}
```

这个新类型要求：

- **渲染层**：添加 `remote_progress` 的渲染组件
- **消息列表**：排序逻辑需要理解 `remote_progress` 的位置
- **历史搜索**：是否索引 `remote_progress` 的内容？
- **过滤器**（`isEligibleBridgeMessage`）：`remote_progress` 应该发给远端吗？
- **compact 逻辑**：上下文压缩时 `remote_progress` 消息如何处理？

每增加一个消息类型，消息相关的所有逻辑都需要显式处理这个新类型——要么有 case，要么有默认行为。这个"处处需要处理"的特性，让添加新类型的实际成本往往远高于类型定义本身。

## 表达力损失的实际影响

降级带来的表达力损失：进度显示变成一行纯文本，没有进度条、没有动态输出流、没有精确的完成百分比。

对用户体验的实际影响取决于：远端任务的进度信息对用户有多重要？

在 Claude Code 当前的使用场景里，远端任务通常是长时间运行的后台任务，用户主要关心"任务在不在跑"和"最终结果"，中间的精细进度是次要信息。

如果未来产品需求变了（比如需要实时显示远端工具的每一行输出），这个降级决策就需要重新评估——届时引入新类型的代价，和表达力提升的收益相比，可能就值得了。

## 面试指导

"什么时候应该引入新类型"是系统设计里一个很实用的问题。

判断框架：

1. **有多少现有逻辑需要处理这个新类型？**（影响范围）
2. **如果不引入新类型，损失的表达力有多重要？**（降级代价）
3. **新类型的使用频率如何？**（低频边缘情况 vs 核心路径）

如果"影响范围广 + 降级代价低 + 使用频率不高"，那么不引入新类型通常是正确的工程决策。

Claude Code 的 `tool_progress` 降级，满足这三个条件：它会影响渲染、搜索、过滤、compact 等几乎所有消息相关逻辑；降级后进度信息仍然可以显示（只是不那么精细）；远端进度消息不是用户交互的主要路径。

这不是懒惰，而是对工程成本的精确权衡。

---
title: "expandKey 为什么要把 tool_use 和 tool_result 折叠成同一个展开单元？"
slug: "11-08-05-tool-usetool-result"
date: 2026-04-09
topics: [终端界面]
summary: "Claude Code 的 expandKey 函数用 tool_use_id 而不是 uuid 作为展开状态的键，这意味着工具请求和结果共用同一个折叠状态，用户折叠的是一次完整的动作，不是两条分开的消息。"
importance: 1
---

# expandKey 为什么要把 tool_use 和 tool_result 折叠成同一个展开单元？

直觉上，展开状态是"这行消息是展开还是折叠的"，每行一个状态就行了。Claude Code 为什么要让两行共用一个键？

## 工具调用在 transcript 里的实际形态

一次 Bash 调用在 transcript 里至少占两行：

- `AssistantMessage` 类型，内容是 `tool_use` 块，包含命令字符串
- `UserMessage` 类型，内容是 `tool_result` 块，包含命令输出

如果有 PostToolUse hook，还会有额外的 `progress` 行。如果使用了 `grouped_tool_use`，多次连续工具调用会被合并成一个视图行，但底层依然是多条消息。

用户看到的是"一次 Bash 执行"，代码里是"两到多条分开的消息"。

## expandKey 的实现

```typescript
function expandKey(msg: RenderableMessage): string {
  if (msg.type === 'assistant') {
    const b = msg.message.content[0]
    if (b?.type === 'tool_use') return b.id  // tool_use_id
  }
  if (msg.type === 'user') {
    const b = msg.message.content[0]
    if (b?.type === 'tool_result') return b.tool_use_id  // 同一个 id
  }
  return msg.uuid  // 其他消息用自己的 uuid
}
```

对于工具请求（assistant 端），key 是 `tool_use` 块的 `id`。
对于工具结果（user 端），key 是 `tool_result` 块的 `tool_use_id`，和前者完全相同。

两行在 `expandedKeys` 这个 `Set<string>` 里共用同一个条目。展开/折叠任何一行，都会同时影响另一行的显示状态。

## 为什么这是正确的语义

展开的目的是让用户看到"这件事的完整上下文"——既包括 AI 发出了什么请求，也包括执行结果是什么。如果请求展开、结果折叠，用户只看到命令字符串，看不到输出；结果展开、请求折叠，看到了输出但不知道是哪条命令触发的。

两者用同一个展开键，保证了"展开这次工具调用"在操作上是原子的，视觉上是完整的。

## 和 buildMessageLookups 的配合

`expandKey` 的逻辑依赖于 `tool_use_id` 的稳定存在，而 `buildMessageLookups` 提供的 `toolUseByToolUseID` 和 `toolResultByToolUseID` 用同一套 ID 体系做索引。这不是偶然的：两者都在承认"一次工具调用"是跨越两条消息的实体，ID 是连接它们的线。

`UserToolResultMessage` 在渲染工具结果时，用 `lookups.toolUseByToolUseID.get(toolUseId)` 找回工具定义，知道它是 Bash、Read 还是 Write，从而决定渲染样式、是否显示截断提示等。这个查找能成立，前提是 `expandKey` 和 `buildMessageLookups` 都用了相同的 `tool_use_id` 作为主键。

## expandedKeys 的更新时机

当用户点击工具调用行时，`MessageRow` 的 onClick 调用 `onItemClick(msg)`，`Messages.tsx` 收到后：

```typescript
setExpandedKeys(prev => {
  const k = expandKey(msg)
  const next = new Set(prev)
  next.has(k) ? next.delete(k) : next.add(k)
  return next
})
```

这个操作针对的是 `expandKey(msg)` 的结果，不是 `msg.uuid`。所以无论用户点的是请求行还是结果行，最终修改的是同一个 key，两行的展开状态同步变化。

## 面试指导

这道题实际上是在问"状态应该按视觉单元组织还是按数据单元组织"。

**Claude Code 的答案**：按语义单元组织。一次工具调用是一个语义单元，即使它在数据层是两条消息。状态（展开键）应该反映语义，不应该反映数据结构。

**延伸到更大的问题**：这是前端状态设计里的核心取舍。如果你按数据行组织状态，实现简单，但你在 UI 里会不断被问"这两行是不是同一件事"；如果你按语义单元组织状态，需要额外的映射逻辑（expandKey），但 UI 的行为会和用户的心智模型一致。

**反驳一个常见答案**：有些人会说"用 parent-child 组件关系来处理，把展开状态放在两行的共同父组件里"。这在树形结构里可行，但 Claude Code 的消息列表是平铺的，工具请求和工具结果没有共同的父组件，只有共同的 ID。用 ID 做 key 比用组件层次做 key 更鲁棒，不受 DOM 结构影响。

**加分点**：提到 `collapsed_read_search` 的情况——多个连续 Read 工具调用被合并成一个折叠行时，expandKey 返回的是合并后 grouped 实体的 key，这是 applyGrouping 和 expandKey 协作的结果。合并之前的多个 tool_use_id 不会单独出现在 expandedKeys 里。

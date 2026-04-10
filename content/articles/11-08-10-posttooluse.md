---
title: "sibling tool use 全部完成才能静态化：这个约束为什么必要？"
slug: "11-08-10-posttooluse"
date: 2026-04-09
topics: [终端界面]
summary: "shouldRenderStatically 的条件不只是自己的 tool_result 到了，还要 sibling 工具调用全部完成。这是因为界面上同一个工具块里的多次调用是一个整体，部分完成和全部完成对用户来说看起来相同，但语义完全不同。"
importance: 1
---

# sibling tool use 全部完成才能静态化：这个约束为什么必要？

Claude 有时候会在一次 assistant 消息里发出多个工具调用，这些调用叫 sibling tool use。`shouldRenderStatically` 要求它们全部完成，为什么一个完成了就不能静态化自己那部分？

## sibling tool use 的来源

在某些模型版本和配置下，Claude 会在一次 turn 里同时调用多个工具（并发执行），例如同时读取 3 个文件。这 3 次 Read 调用在 API 层面是同一条 assistant 消息里的 3 个 `tool_use` content block，它们有各自的 `id` 但都来自同一个 `uuid`（消息级 ID）。

`buildMessageLookups` 的第一轮扫描在遇到含多个 `tool_use` 块的 assistant 消息时，会构建 sibling 关系：

```typescript
// 同一条消息里的所有 tool_use_id
const toolUseIds = assistantMsg.message.content
  .filter(b => b.type === 'tool_use')
  .map(b => b.id)

// 每个 id 的 sibling = 其他所有 id
for (const id of toolUseIds) {
  siblingToolUseIDs.set(id, toolUseIds.filter(s => s !== id))
}
```

## grouped_tool_use 的渲染单元

在视觉层，连续的同类工具调用被 `applyGrouping` 合并成 `grouped_tool_use`，用户看到的是一个折叠的组（例如"3 次 Read"），而不是 3 行。组里的工具调用有先有后，结果陆续到达。

如果只要求"自己的 tool_result 到了就静态化"，那么第一个 Read 完成后就会切到静态，第二个还在进行中时，这个 grouped 组的状态会是"部分静态、部分动态"——但用户看到的是同一个折叠行，他无法判断这个折叠行是"完成中"还是"全部完成"。

视觉单元（折叠组）和数据单元（单个工具调用）不对齐，界面就会出现自相矛盾的状态。

## shouldRenderStatically 的 sibling 检查

```typescript
function shouldRenderStatically(toolUseId: string, lookups: Lookups): boolean {
  if (!lookups.resolvedToolUseIDs.has(toolUseId)) return false
  if (hasUnresolvedHooksFromLookup(toolUseId, 'PostToolUse', lookups)) return false
  
  const siblings = lookups.siblingToolUseIDs.get(toolUseId) ?? []
  if (!siblings.every(sid => lookups.resolvedToolUseIDs.has(sid))) return false
  
  return true
}
```

第三个条件要求所有 sibling 的 ID 都在 `resolvedToolUseIDs` 里。只要有一个 sibling 还没完成，所有 sibling 都保持动态状态。

这保证了：在 grouped 组的全部工具调用都完成之前，整个组保持在可接受 streaming 更新的动态状态；一旦最后一个完成，整个组一起切换到静态。

## 切换时机的对齐

这里有一个细节：各个 sibling 的 `tool_result` 不一定同时到达（并发执行时结果先后不定）。假设 3 个 Read，第一个 1 秒后完成，第二个 1.5 秒，第三个 2 秒。

在 2 秒之前，3 个 sibling 都不静态化（即使前两个已经有结果了）。在 2 秒时（第三个结果到达），lookups 更新后 3 个 sibling 全部满足静态化条件，它们在同一次渲染里一起切换到静态。

用户感受到的是：整个"3 次 Read"组从"运行中"状态一次性变为"完成"状态，而不是逐个完成的阶梯式变化。

## 面试指导

这道题考的是"视觉一致性"在实现层如何保证，以及跨消息的协调如何通过共享 lookup 而不是组件间通信实现。

**核心论证**：视觉单元（grouped 折叠组）和数据单元（单个工具调用）的边界不一致时，渲染状态必须在视觉单元的粒度上做决策，不能在数据单元的粒度上各自为政。sibling check 是把数据粒度的完成信号提升到视觉单元粒度的机制。

**横向对比**：React 里类似的问题是"同时更新两个相关 state"。解法是把两个 state 合并成一个，或者用 `useReducer` 在同一个 dispatch 里原子地更新两者，避免中间状态被渲染出来。sibling check 在概念上类似：通过"全部完成才切换"，避免渲染出"部分完成"这个中间状态。

**追问**：如果一个 sibling 调用失败（erroredToolUseIDs 里有它），另外两个成功了，整个组会怎么处理？答：失败的调用进入 `erroredToolUseIDs`，`resolvedToolUseIDs` 里也会有它（resolved 的语义是"有了结果"，包括错误结果）。所以失败的调用同样会让 sibling check 通过，不会导致整个组永远不静态化。错误状态的显示是独立的逻辑（`erroredToolUseIDs` 用于渲染错误样式），不和静态化逻辑耦合。

---
title: "buildMessageLookups 用 O(n) 查找表替代 O(n²) 遍历，省了多少？"
slug: "11-08-01-buildmessagelookups"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# buildMessageLookups 用 O(n) 查找表替代 O(n²) 遍历，省了多少？

面试问题直接问：一个组件需要"找到当前 tool_use 对应的 tool_result"，最朴素的写法是什么，Claude Code 的实际做法是什么，差距在哪？

## 朴素写法的代价

朴素写法：每个 `AssistantToolUseMessage` 渲染时，从 props 里拿到整个消息数组，线性扫描找到 `type === 'user' && content[0].tool_use_id === myId` 的那条。每条消息 O(n)，n 条消息全渲染 → O(n²)。更糟的是，sibling 关系（同一次 `tool_use` 块里有多个工具调用）、progress 行、PostToolUse hook 都要各自再扫一遍，实际是 O(k×n²)，k 是关联类型数。

流式场景下每收到一个 `input_json_delta` 就触发一次渲染，这个代价在 200 条消息的会话里已经明显可感。

## buildMessageLookups 的实际结构

`Messages.tsx` 在渲染前先调用 `buildMessageLookups(normalizedMessages, messagesToShow)`，一次 O(n) 扫描建出 7 张表：

```
toolUseByToolUseID          Map<string, AssistantToolUse>
toolUseIDToMessageID        Map<string, string>
siblingToolUseIDs           Map<string, string[]>
progressMessagesByToolUseID Map<string, ProgressMessage[]>
toolResultByToolUseID       Map<string, UserToolResult>
resolvedToolUseIDs          Set<string>
erroredToolUseIDs           Set<string>
inProgressHookCounts        Map<string, Map<string, number>>
resolvedHookCounts          Map<string, Map<string, number>>
```

扫描逻辑分两轮：第一轮过 assistant 消息，把所有 `tool_use` 块的 ID 和 sibling 关系写进前三张表；第二轮过 user、progress、hook_attachment 行，补出结果状态、进度映射和 hook 计数。

结果通过 `lookupsRef.current = lookups` 传给下游，任何组件读关系都是 O(1)。

## 为什么要分两轮而不是一轮

第一个问题的答案是：sibling 关系需要同一次 assistant 消息里的多个 `tool_use` 块互相引用，只有先把一条 assistant 消息里的所有工具 ID 收集完，才能回填 `siblingToolUseIDs`。

第二个问题：为什么 `buildMessageLookups` 同时接收 `normalizedMessages` 和 `messagesToShow`？因为 progress 行和 hook attachment 只需要出现在视口里，但 `tool_use` 和 `tool_result` 的因果链必须从完整的 normalized 数组里扫，否则超出视口的工具请求就找不到它的结果。

## ref 而不是 prop

建出来的 lookups 不是作为 prop 传进每个子组件，而是通过 `lookupsRef.current` 提供给 `isItemClickable` 回调使用。原因：`isItemClickable` 用 `useCallback([tools])` 稳定化，如果 lookups 进入 deps，每次消息更新都重建 callback，VirtualMessageList 里绑定的 onClick 也跟着换，导致正在进行中的 hover 状态失效。用 ref 分离数据更新和函数身份，是这里的关键设计决策。

## shouldRenderStatically 的门槛

`MessageRow` 的 `shouldRenderStatically` 依赖 lookups：

```typescript
function shouldRenderStatically(msg, lookups) {
  const resolved = lookups.resolvedToolUseIDs.has(toolUseId)
  const hasUnresolved = hasUnresolvedHooksFromLookup(toolUseId, 'PostToolUse', lookups)
  return resolved && !hasUnresolved
}
```

意思是：就算 `tool_result` 已经到了，只要 PostToolUse hook 还在跑，消息就保持动态状态继续接受渲染更新。这是 lookup 驱动渲染决策的直接体现，不是由某个本地 flag 控制的。

## 面试指导

这道题真正在考的是"组件职责边界"和"共享状态的正确形式"。

**常见错误答案**：把 lookups 用 React Context 传递。Context 变化会触发所有消费者重渲，而 lookups 在流式期间每次 delta 都更新，等于把最热的路径插入了全局广播。正确的做法是 ref（不触发渲染）+ 在需要的地方直接读。

**进阶追问**：如果 session 有 2000 条消息，每次追加一条消息时 buildMessageLookups 会重跑全量，怎么优化？答：消息数组是 append-only 的，可以增量更新——只把新增的那条消息加入已有的 Map/Set，不重建。但 Claude Code 当前的实现是全量重建，因为流式场景里 tool_result 不一定在 tool_use 之后紧跟，sibling 修改也可能影响早先的条目。这是一个有意识的 simplicity 取舍。

**面试现场的加分句**：提到 WeakMap 用于缓存搜索文本（VirtualMessageList 里的 `fallbackLowerCache`），它和 lookups 形成两层缓存体系：一层负责关系图（Map），一层负责搜索文本（WeakMap，随消息对象 GC 自动释放）。

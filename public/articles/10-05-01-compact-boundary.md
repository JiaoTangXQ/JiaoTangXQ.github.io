---
title: "compact boundary 是什么？压缩后的消息流怎么被切片？"
slug: "10-05-01-compact-boundary"
date: 2026-04-09
topics: [上下文管理]
importance: 1
---

# compact boundary 是什么？压缩后的消息流怎么被切片？

压缩完成后，系统里其实同时存在两类消息：
1. 原始的历史消息（在 REPL 状态里，供 UI 显示用）
2. 压缩后的消息视图（每次 API 调用实际发送的内容）

这两者如何分离，靠的是 **compact boundary**。

---

## compact boundary marker 的结构

每次 compact 完成，会创建一个 `SystemCompactBoundaryMessage`：

```typescript
const boundaryMarker = createCompactBoundaryMessage(
  isAutoCompact ? 'auto' : 'manual',
  preCompactTokenCount ?? 0,
  messages.at(-1)?.uuid,  // 最后一条被压缩的消息的 uuid
)
```

这个 marker 里包含：
- compact 触发方式（`'auto'` / `'manual'`）
- 压缩前的 token 数（用于分析和遥测）
- 被压缩的最后一条消息的 uuid（用于消息链接的修复）
- `compactMetadata`：包括 `preCompactDiscoveredTools`（压缩前已加载的 deferred tool 名称）

boundary marker 是一个系统消息，**不发送给 API**（不在 `user` / `assistant` 角色里），但它存在于 REPL 的消息数组中，作为分割线。

---

## getMessagesAfterCompactBoundary：切片逻辑

```typescript
export function getMessagesAfterCompactBoundary(messages: Message[]): Message[] {
  // 从后往前找最后一个 compact boundary
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isCompactBoundaryMessage(messages[i])) {
      return messages.slice(i)  // 返回 boundary 及其之后的所有消息
    }
  }
  return messages  // 没有 compact 过，返回全部
}
```

每次进入 query loop，都从 `getMessagesAfterCompactBoundary(messages)` 取消息，而不是直接用原始数组。这保证了：

1. **模型看到的永远是压缩后的视图**：boundary marker 之前的原始消息不可见
2. **多次 compact 都能正确处理**：总是找最后一个 boundary

---

## 压缩后的消息流布局

来自 `buildPostCompactMessages(result)` 的消息按序排列：

```
[SystemCompactBoundaryMessage]      ← boundary marker（不发 API）
[UserMessage: isCompactSummary=true]  ← 摘要消息（发 API）
[...(messagesToKeep)]               ← partial compact 保留的原始消息
[...attachments]                    ← 重注入的文件/工具/plan
[...hookResults]                    ← session start hooks
```

当下一次 query 进来，`getMessagesAfterCompactBoundary` 切出这段内容，附上新的用户消息，发送给 API。

---

## preCompactDiscoveredTools 的重要性

boundary marker 里有一个特殊字段：

```typescript
const preCompactDiscovered = extractDiscoveredToolNames(messages)
if (preCompactDiscovered.size > 0) {
  boundaryMarker.compactMetadata.preCompactDiscoveredTools = [
    ...preCompactDiscovered,
  ].sort()
}
```

这解决了一个微妙问题：某些工具（deferred tools）只有在模型第一次使用之后才会发送完整 schema。压缩发生后，"工具已被发现"这个状态消失了，下一轮系统会认为模型还没看过这些工具，重新发送完整 schema——浪费 token。

把"压缩前已发现的工具"记录在 boundary marker 里，下一轮就能知道"这些工具已经发过了，不用重新发"，只发 delta。

---

## annotateBoundaryWithPreservedSegment：partial compact 的消息链接

当 partial compact（保留尾部消息）发生时，boundary 需要记录保留消息的 uuid 链接：

```typescript
export function annotateBoundaryWithPreservedSegment(
  boundary: SystemCompactBoundaryMessage,
  anchorUuid: UUID,
  messagesToKeep: readonly Message[] | undefined,
): SystemCompactBoundaryMessage {
  const keep = messagesToKeep ?? []
  if (keep.length === 0) return boundary
  return {
    ...boundary,
    compactMetadata: {
      ...boundary.compactMetadata,
      preservedSegment: {
        headUuid: keep[0]!.uuid,   // 保留片段的开头
        anchorUuid,                 // 锚点（摘要消息的末尾）
        tailUuid: keep.at(-1)!.uuid, // 保留片段的结尾
      },
    },
  }
}
```

这些 uuid 信息用于在磁盘上的消息文件（transcript）里修复消息树的父子关系，让 `/resume` 能正确重建会话状态。

---

## boundary 和 UI 的关系

REPL 的 UI 会在消息列表里显示 compact 发生的位置——用户往上滚动时能看到"这里发生过一次 compact"的视觉提示。这个 UI 元素的数据来源就是 boundary marker。

压缩前的原始消息仍然保留在 REPL 状态里（不删除），但它们不发给 API。用户在 UI 里往上滚动还是能看到历史，但 AI 的"记忆"是从摘要重新开始的。

这解释了为什么 `/compact` 命令里有这样的处理：
```typescript
// REPL keeps snipped messages for UI scrollback
messages = getMessagesAfterCompactBoundary(messages)
```
传给 `compactConversation` 的是切片后的消息（只有活跃部分），而不是完整的 REPL 历史。

---

## 面试指导

"compact boundary 解决了什么问题"是一个设计意图题。

核心回答：**它让 REPL 状态（UI 显示用）和 API 消息流（模型看到的）可以独立维护**。原始历史保留用于 UI，API 只收到压缩后的视图。没有 boundary marker，每次 compact 都要删除原始消息，UI 就看不到历史了；有了 boundary，系统可以"逻辑删除"（只截取）而不是"物理删除"。

能说清这个设计如何同时满足"用户能看历史"和"模型用压缩后的上下文"这两个需求，是理解 compact 机制的关键一步。

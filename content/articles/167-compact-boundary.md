---
title: "compact boundary 是什么，为什么压缩后必须插入这条边界消息"
slug: "167-compact-boundary"
date: 2026-04-09
topics: [上下文管理, 内存架构, 会话连续性]
importance: 0.9
---

# compact boundary 是什么，为什么压缩后必须插入这条边界消息

面试题形式：**Claude Code 在 /compact 之后会向消息列表插入什么，为什么 compact boundary 不能省略？**

## 压缩之后留下什么

调用 `/compact` 或 autocompact 触发后，`compactConversation()` 会生成一条新的消息列表，历史对话被替换为一份摘要。整个过程结束后，代码会调用：

```ts
createCompactBoundaryMessage()
```

这条消息的类型是 `SystemCompactBoundaryMessage`，被插入到新消息列表的开头（或摘要之后）。它不包含对话内容，只携带一个标志：**此后的消息是在压缩后的世界里产生的。**

## boundary 消息解决什么问题

如果只保留摘要，没有边界标记，系统就无法区分一段历史是「压缩前的原始消息」还是「压缩后新增的消息」。这在以下场景中会出错：

**1. 附件重注入**

每次对话开始后，`createAttachmentMessage()` 会把 CLAUDE.md、计划文件、skill 内容等附件注入进来。`compact.ts` 里有一段逻辑叫 `getMessagesAfterCompactBoundary()`，它专门找到最新的 boundary 消息，只看 boundary 之后的消息，避免把旧附件又读进来造成重复或冲突。

**2. 防止重复压缩**

`shouldAutoCompact()` 判断是否需要再次触发 autocompact，依赖的 token 计数必须基于「当前有效窗口」。如果没有 boundary 标记，系统在统计 token 时可能把压缩前的历史也算进去，导致立刻又触发一次多余的压缩。

**3. recompaction chain 追踪**

`RecompactionInfo` 结构中记录了 `isRecompactionInChain` 字段——当前这次压缩是否是上一次压缩的续压。这个判断依赖 `tracking.compacted`，而 `tracking.compacted` 的重置时机恰好是在插入了新 boundary 之后。

## boundary 消息长什么样

从 `messages.ts` 的类型定义可以看到：

```ts
type SystemCompactBoundaryMessage = {
  type: 'system_compact_boundary'
  uuid: string
  // 可以携带 preserved segment 注解
}
```

`annotateBoundaryWithPreservedSegment()` 函数还可以在 boundary 上附加额外信息，说明「保留了哪一段原始历史」——这在 session memory compaction 路径下尤为重要，因为那条路径不是全量替换，而是截断后保留最近 N 条消息。

## isCompactBoundaryMessage 的检测逻辑

系统中多处调用 `isCompactBoundaryMessage(msg)`，它只是检查 `msg.type === 'system_compact_boundary'`。凡是需要「从最近一次压缩点开始重建视图」的逻辑，都通过这个函数定位基准线：

- `compact.ts` 的 `buildPostCompactMessages()`
- `sessionMemoryCompact.ts` 的 preserved segment 截断
- 附件注入逻辑的去重判断

## 面试要点

**Q：compact boundary 为什么不能用消息 index 或时间戳代替？**

因为消息 index 在每次压缩后重排，不稳定；时间戳无法区分「同一时刻生成的摘要消息」和「压缩后首条真实消息」。只有类型标记是稳定且不歧义的。

**Q：session memory compaction 和全量 compact 对 boundary 的处理有何不同？**

全量 compact（`compactConversation`）完全替换消息列表，boundary 插在最前；session memory compaction（`trySessionMemoryCompaction`）只截断消息，保留最近 N 条，boundary 插在截断点处，并通过 `annotateBoundaryWithPreservedSegment()` 附加保留段信息，方便后续区分「这条 boundary 保留了历史」和「这条 boundary 完全丢弃了历史」。

**Q：为什么 autocompact 成功后要调用 `setLastSummarizedMessageId(undefined)`？**

因为压缩后旧的消息 UUID 全部失效，session memory 依赖 `lastSummarizedMessageId` 来定位上次提取位置——如果不清空，下一次 session memory 更新会试图从一个已经不存在的消息 UUID 开始计数，导致 tool call 计数错误。

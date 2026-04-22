---
title: "session memory 是什么？它和 compact 的区别在哪里？"
slug: "10-06-01-session-memory"
date: 2026-04-09
topics: [上下文管理]
importance: 1
---

# session memory 是什么？它和 compact 的区别在哪里？

Claude Code 里有两种不同的"保存会话状态"机制：session memory 和 compact（摘要）。面试题变体："如果上下文快满了，session memory 和 compact 分别做什么？"

---

## 一句话区别

**compact**：把对话历史压缩成摘要，用摘要替换历史，历史信息降级为"曾经发生过什么"的概述。

**session memory**：把"当前工作状态"写成一份外置笔记（文件），在下次 compact 时把这份笔记当作上下文的基础，可以保留比摘要更精确的"现在做到哪里了"。

---

## session memory 的触发时机

session memory 不是在"上下文快满"时才运行——它是更早的机制，维护一份持续更新的工作状态文件。

在 `autoCompactIfNeeded` 和 `/compact` 命令里，系统会**先**尝试 session memory 路径：

```typescript
const sessionMemoryResult = await trySessionMemoryCompaction(
  messages,
  toolUseContext.agentId,
  recompactionInfo.autoCompactThreshold,
)
if (sessionMemoryResult) {
  // 使用 session memory 结果，不调用 compactConversation
  return { wasCompacted: true, compactionResult: sessionMemoryResult }
}
```

如果 session memory 路径成功，就**不**调用 `compactConversation`。session memory 是 compact 的轻量前置路径，只有它失败或不适用时才走完整 compact。

---

## session memory 文件存放在哪里

session memory 文件存储在 `~/.claude/projects/<project-path>/memory/session-*.md` 类似的路径下（具体路径由 `memdir/paths.ts` 管理）。这是**磁盘上的实际文件**，不是内存状态。

好处是：
1. **跨会话可用**：重启 Claude Code 后，上次的工作状态还在
2. **可以被模型读取**：作为附件注入上下文，让模型知道"上次工作到哪里了"
3. **轻量**：不需要发一次摘要 API 请求，写文件比发请求快

---

## session memory 的内容是什么

session memory 不是整段对话的摘要——它是一份"工作台快照"，描述：
- 当前正在做的任务（是什么、做到哪里了）
- 待办事项和已完成的步骤
- 关键的技术决策
- 上次停在哪里

这和 compact 摘要的侧重点不同。compact 摘要偏向"发生了什么"（历史叙述），session memory 偏向"现在状态是什么"（工作台状态）。

---

## session memory compact 的工作方式

当 session memory 路径用于 compact 时（`trySessionMemoryCompaction`），它构建的 `CompactionResult` 不包含 `summaryMessages`，而是把 session memory 文件作为附件注入：

```typescript
// 来自 sessionMemoryCompact.ts 的大致逻辑
return {
  boundaryMarker: createCompactBoundaryMessage('auto', preTokens, lastMsgUuid),
  summaryMessages: [],    // 没有摘要消息
  attachments: [sessionMemoryAttachment, ...otherAttachments],
  hookResults: [],
  messagesToKeep: recentMessages,  // 保留最近的几轮消息
}
```

它不生成文字摘要，而是保留：
1. session memory 文件作为附件
2. 最近几轮的原始消息（比摘要保留了更多细节）

这个组合比纯摘要更精确——"最近实际发生了什么"是原始内容，"更早的历史"通过 session memory 文件的摘要注入。

---

## 更新时机：不在每轮，而在自然停顿点

session memory 的更新不是每轮都发生。它有阈值和停顿点的判断逻辑，确保：
1. 主回合不被打断（更新发生在回合结束后的 stop hooks 里）
2. 不是每轮都更新（避免频繁 IO 和 API 调用）
3. 在自然停顿（用户暂停、任务阶段完成）时更新

这意味着 session memory 可能比当前状态**滞后一小段**。如果模型在 stop hooks 触发之前就触发了 compact，session memory 的内容是最后一次写入时的状态，不是实时的。

这是一个有意识的设计取舍：实时性换取主回合的稳定性。

---

## session memory 和 auto-memory 的区别

这里有个容易混淆的地方：

| 维度 | session memory | auto-memory |
|------|---------------|-------------|
| 内容 | 当前工作台状态 | 项目长期知识 |
| 粒度 | 单次会话的进度 | 跨会话的积累 |
| 生命周期 | 随会话更新 | 长期保留 |
| 触发方式 | compact 前路径 + 定期更新 | stop hooks 里的后台提炼 |
| 存储位置 | session 相关路径 | `~/.claude/projects/<path>/memory/*.md` |

session memory 是"今天工作到哪里了"，auto-memory 是"这个项目里我积累了哪些知识"。

---

## 面试指导

"session memory 和 compact 的区别"是一道考察你是否理解"状态 vs 历史"这个根本差异的题。

关键答案：compact 是把历史转换成摘要，信息以"发生过什么"的形式存在；session memory 维护的是工作台状态，信息以"现在做到哪里了"的形式存在。

在 compact 触发时优先使用 session memory，是因为"知道现在在做什么"比"知道历史上发生了什么"对继续工作更有用。这个优先级顺序揭示了两种机制的本质定位差异。

---
title: "手动 /compact 和 autocompact 有什么本质区别？"
slug: "10-04-01-compact"
date: 2026-04-09
topics: [上下文管理]
summary: "/compact 命令与 autocompact 走同一套 compactConversation 逻辑，但在 session memory 优先路径、自定义指令支持和触发时机上有关键差异。"
importance: 1
---

# 手动 /compact 和 autocompact 有什么本质区别？

表面上看，`/compact` 和 autocompact 都是"压缩对话历史"——它们都调用 `compactConversation()`，生成摘要，重组消息流。但从 `commands/compact/compact.ts` 的实现来看，两者有几个本质差异。

---

## 共同的底层：compactConversation

先明确共同点。无论是手动触发还是自动触发，最终都走同一个 `compactConversation()` 函数，生成同样结构的 `CompactionResult`：

```typescript
export interface CompactionResult {
  boundaryMarker: SystemMessage
  summaryMessages: UserMessage[]
  attachments: AttachmentMessage[]
  hookResults: HookResultMessage[]
  messagesToKeep?: Message[]
  // ...
}
```

两者的摘要质量、重注入逻辑、compact boundary 标记都是一样的。差异在**触发条件**、**前置路径**和**用户控制度**上。

---

## 差异 1：自定义指令

手动 `/compact` 支持自定义指令，autocompact 不支持：

```typescript
// commands/compact/compact.ts
export const call: LocalCommandCall = async (args, context) => {
  const customInstructions = args.trim()  // 用户在 /compact 后面输入的内容
  // ...
  const result = await compactConversation(
    messagesForCompact,
    context,
    // ...
    customInstructions,  // 传入
    false,               // isAutoCompact = false
  )
}
```

```typescript
// autoCompact.ts
const compactionResult = await compactConversation(
  messages,
  toolUseContext,
  cacheSafeParams,
  true,       // suppressFollowUpQuestions
  undefined,  // 没有自定义指令
  true,       // isAutoCompact = true
)
```

自定义指令让用户能告诉摘要模型"保留什么、侧重什么"。比如：
- `/compact 重点保留关于性能优化的讨论`
- `/compact 确保 API 设计决策完整保留`

autocompact 在用户没有参与的情况下触发，没有机会询问用户的偏好，所以只能用默认的摘要策略。

---

## 差异 2：session memory 优先路径的条件

两者都会先尝试 `trySessionMemoryCompaction()`，但条件不同：

```typescript
// commands/compact/compact.ts
if (!customInstructions) {
  // 只有没有自定义指令时才尝试 session memory 路径
  const sessionMemoryResult = await trySessionMemoryCompaction(messages, context.agentId)
}
```

```typescript
// autoCompact.ts - autoCompactIfNeeded
// 无条件尝试（没有自定义指令的概念）
const sessionMemoryResult = await trySessionMemoryCompaction(
  messages,
  toolUseContext.agentId,
  recompactionInfo.autoCompactThreshold,
)
```

如果用户用了自定义指令（比如 `/compact 保留测试相关的讨论`），session memory 路径会被跳过，直接走 `compactConversation`。原因是：session memory 路径是预先规划的，无法动态响应用户的自定义指令。

注意 autocompact 路径在调用 `trySessionMemoryCompaction` 时还传了 `autoCompactThreshold`——这让 session memory 路径知道当前的压力阈值，可以判断是否值得用 session memory 来避免系统级 compact。

---

## 差异 3：前置 microcompact

手动 `/compact` 在调用 `compactConversation` 之前会先跑一次 microcompact：

```typescript
// commands/compact/compact.ts
const microcompactResult = await microcompactMessages(messages, context)
const messagesForCompact = microcompactResult.messages

const result = await compactConversation(
  messagesForCompact,  // 经过 microcompact 的版本
  // ...
)
```

这样做的目的是让 compact 的输入更小——工具结果清干净之后，`compactConversation` 里的摘要 API 调用会更便宜，也更不容易 prompt_too_long。

autocompact 在 `query.ts` 里的执行顺序是：先跑 microcompact，再判断是否需要 autocompact。所以 autocompact 拿到的 `messages` 已经是经过 microcompact 的版本了，不需要在 `compactConversation` 里再做。

---

## 差异 4：触发时机的主导权

这是最根本的差异：
- **autocompact**：系统决定，用户没有说话的机会。条件满足就触发，发生在下一轮 API 调用之前。
- **手动 compact**：用户主动触发，可以选择任何时机，可以加指令，可以选择不压缩。

这个主导权差异意味着手动 compact 可以在"我知道接下来要做什么"时整理上下文，比如：
- 在开始一个新的子任务之前，先 compact 掉前一个子任务的历史
- 在某个阶段性里程碑时 compact，并告知"这阶段的决策是 X、Y、Z"

这种有意识的整理方式，比系统在 token 压力下被动触发的 compact 质量更高——用户知道什么值得保留，系统不知道。

---

## hook 的差异

pre-compact hooks 对两者都执行，但 `trigger` 字段不同：

```typescript
// compactConversation 内部
const hookResult = await executePreCompactHooks(
  { trigger: isAutoCompact ? 'auto' : 'manual', ... },
)
```

外部工具（比如 CI 系统）可以注册 pre-compact hooks，根据 trigger 类型做不同的处理——比如自动触发时打日志，手动触发时发通知。

---

## 面试指导

"手动 compact 和自动 compact 的区别"乍看简单，但能从这几个维度展开：

1. **主导权**：自动 compact 是系统的保命机制，手动 compact 是用户的主导工具
2. **自定义能力**：手动 compact 可以带指令，自动 compact 没有
3. **前置处理**：手动 compact 自己跑 microcompact，自动 compact 依赖 query loop 里的顺序
4. **session memory 路径条件**：手动 compact 带指令时跳过 session memory 路径

能说清楚"为什么即使有自动 compact，手动 compact 仍然有价值"，这说明你理解了两者在设计意图上的不同，而不只是实现上的差异。

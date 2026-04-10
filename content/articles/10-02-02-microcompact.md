---
title: "thinking block 为什么不能被 microcompact 清除？"
slug: "10-02-02-microcompact"
date: 2026-04-09
topics: [上下文管理]
summary: "thinking block 有严格的 API 协议约束，必须在整个 assistant trajectory 中保持连贯，这个限制直接影响了 microcompact 的白名单设计。"
importance: 1
---

# thinking block 为什么不能被 microcompact 清除？

微观上看，microcompact 的白名单决策背后有一条不那么直观的约束：**thinking blocks 不能被随意删除**。

这个约束不来自"我们想保留思考过程"，而来自 API 的硬性协议要求。

---

## thinking block 的三条规则

`query.ts` 顶部有一段被称为"规则"的注释，内容如下（原文刻意写得像咒语，因为违反它会导致一整天的调试）：

```
规则 1：包含 thinking 或 redacted_thinking block 的消息，必须属于一个 max_thinking_length > 0 的 query
规则 2：thinking block 不能是某个 block 数组的最后一个元素
规则 3：thinking blocks 必须在整个 assistant trajectory 中保留
```

第三条是关键。"assistant trajectory"的意思是：如果一个 assistant message 里有 thinking block，那么这条 thinking block 必须一直留着，直到这整个 turn 结束——包括这条 assistant message、它调用的所有 tool、以及后续的 assistant message。

这意味着你不能只删掉某个 assistant message 里的 thinking 内容，然后保留 tool_use block——这会破坏协议。

---

## 这对 microcompact 的影响

microcompact 的核心操作是：找到 COMPACTABLE_TOOLS 里的工具调用结果，把它们的 content 替换成占位符。

这个操作在没有 thinking block 的场景下很干净——assistant message 里有 tool_use block，对应的 user message 里有 tool_result block，把 tool_result 的 content 清掉就行了，assistant message 完全不用动。

但在有 thinking block 的场景下，问题来了：

**场景**：assistant message A 包含 [thinking block, tool_use block 1, tool_use block 2]

如果你只清除 tool_use 1 和 tool_use 2 对应的 tool_result，没问题，assistant message A 完整保留，thinking block 完整保留，符合规则。

**但如果你想"删掉整个旧 assistant message A 来省空间"呢？**

不行。因为 assistant message A 里有 thinking block，你不能把它删掉，除非你把整个 trajectory（包括后续的 tool_result 和 assistant message）都一起删了。

这就是为什么 thinking block 的清除是独立的机制——`clear_thinking_20251015` 策略（来自 `apiMicrocompact.ts`）：

```typescript
if (hasThinking && !isRedactThinkingActive) {
  strategies.push({
    type: 'clear_thinking_20251015',
    keep: clearAllThinking
      ? { type: 'thinking_turns', value: 1 }  // 缓存失效时只保留最后1个
      : 'all',  // 正常情况下保留全部
  })
}
```

这个策略通过 API 的 context management 接口执行，在服务端清除旧的 thinking blocks，不是在客户端修改消息数组。

---

## redacted thinking 是特例

当 `isRedactThinkingActive` 为 true 时，thinking blocks 已经被替换成 `redacted_thinking` blocks——这种块对模型是不可见的（只有 API 内部能解密），所以清不清都无所谓，直接跳过：

```typescript
if (hasThinking && !isRedactThinkingActive) {
  // 只有在非 redact 模式下才需要处理 thinking
```

---

## 时间触发时的 thinking 处理

有一个边界情况：当时间触发（缓存失效）的 microcompact 执行时，`clearAllThinking` 会被设为 true：

```typescript
keep: clearAllThinking
  ? { type: 'thinking_turns', value: 1 }  // 只保留最后1个 thinking turn
  : 'all'
```

原因是：既然缓存已经失效，维护"保留所有 thinking blocks 以利用缓存"这个策略就失去意义了。不如只保留最近的一个，把远古的 thinking blocks 清掉，减少重新缓存的成本。

但注意 `value: 1` 而不是 `value: 0`——API schema 要求 `value >= 1`，不能完全清空，至少保留最后一个 thinking turn。

---

## 工程启示

这个例子揭示了一个设计原则：**上下文清理操作的安全边界是由协议约束决定的，不只是由"是否还有用"决定的**。

即使某个 thinking block 里的内容已经"用完了"，你也不能随便删——因为 API 的一致性约束要求它们和对应的 tool_use 轨迹保持连贯。违反这个约束会导致 API 错误，而不只是上下文变差。

在设计自己的上下文管理系统时，同样要区分两类内容：
1. **可以安全清除的**：内容本身已无用，且没有协议约束
2. **有结构约束的**：必须按规则整体删除或整体保留，不能只清除一部分

microcompact 白名单的精准程度，其实是这两类约束共同作用的结果。

---

## 面试指导

"thinking blocks 为什么不能被 microcompact 清除"是一道考察你是否真正读过源码或文档的题。

表层答案："因为思考过程是有价值的，我们想保留它。"

深层答案："因为 API 协议要求 thinking blocks 在整个 assistant trajectory 中保持连贯，随意删除会导致 API 错误，这是硬性约束，不是设计偏好。清除思考块需要通过独立的 context management 接口，按 turn 粒度而不是按 token 粒度操作。"

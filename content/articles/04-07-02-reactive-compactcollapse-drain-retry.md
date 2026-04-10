---
title: "故障恢复分析：收到 413 后，系统如何在 3 秒内悄悄自救？"
slug: "04-07-02-reactive-compactcollapse-drain-retry"
date: 2026-04-09
topics: [主循环]
summary: "Anthropic API 的 413（prompt too long）不是终局，而是一个可以自救的错误。Claude Code 在收到 413 后会先把它扣住不报，尝试两级应急压缩，如果自救成功，外层调用方完全感知不到曾经有过一次 413。这个 withholding 模式是怎么工作的？"
importance: 1
---

# 故障恢复分析：收到 413 后，系统如何在 3 秒内悄悄自救？

## Withholding 模式：先扣住错误

`query()` 的流式消费循环里，收到 API 返回的错误消息时，有一段不寻常的逻辑：

```typescript
// 流式消费循环内
let withheld = false

if (feature('CONTEXT_COLLAPSE')) {
  if (contextCollapse?.isWithheldPromptTooLong(message, isPromptTooLongMessage, querySource)) {
    withheld = true
  }
}
if (reactiveCompact?.isWithheldPromptTooLong(message)) {
  withheld = true
}
if (mediaRecoveryEnabled && reactiveCompact?.isWithheldMediaSizeError(message)) {
  withheld = true
}

if (!withheld) {
  yield yieldMessage  // ← 只有不被 withhold 的消息才会输出
}
```

413 错误（prompt too long）和媒体大小错误会被 `withheld = true`——这些消息**不会被 yield 出来**，会在 `assistantMessages` 里被静默积累，等流结束后由恢复逻辑处理。

这是一个关键的设计选择：SDK 集成方（比如 Claude.ai、桌面应用）通常会在收到 `error` 字段的消息时中断会话。如果立刻把 413 暴露出去，会话就结束了，没有恢复机会。Withholding 给了内部恢复逻辑一个窗口。

## 两级应急恢复

流式消费结束后（`!needsFollowUp`，即模型没有输出 tool_use 块），系统检查被 withhold 的错误：

```typescript
const isWithheld413 =
  lastMessage?.type === 'assistant' &&
  lastMessage.isApiErrorMessage &&
  isPromptTooLongMessage(lastMessage)
```

**第一级：Collapse Drain Retry**

```typescript
if (
  feature('CONTEXT_COLLAPSE') &&
  contextCollapse &&
  state.transition?.reason !== 'collapse_drain_retry'  // ← 只尝试一次
) {
  const drained = contextCollapse.recoverFromOverflow(
    messagesForQuery, querySource,
  )
  if (drained.committed > 0) {
    const next: State = {
      messages: drained.messages,
      ...
      transition: { reason: 'collapse_drain_retry', committed: drained.committed },
    }
    state = next
    continue  // ← 用更小的上下文重试
  }
}
```

`recoverFromOverflow()` 把所有"已 staged 但还没提交"的 context collapse 一次性提交。这些 collapse 是系统在之前几轮就已经计算好、准备好但还没应用的压缩操作。

为什么叫"drain"？因为这就像排干一个已经装好的水桶——不需要重新计算，只需要把已经准备好的东西应用出来。这比 reactive compact 便宜得多，没有新的 LLM 调用，只是把暂存的折叠提交。

`state.transition?.reason !== 'collapse_drain_retry'` 防止无限循环：如果上一次就是因为 drain 才重试的，这次 drain 后还是 413，说明 drain 没能解决问题，不应该再次 drain。

**第二级：Reactive Compact Retry**

如果 drain 不够（没有 staged collapse，或 drain 后还是太长）：

```typescript
if ((isWithheld413 || isWithheldMedia) && reactiveCompact) {
  const compacted = await reactiveCompact.tryReactiveCompact({
    hasAttempted: hasAttemptedReactiveCompact,  // ← 防止重复触发
    querySource,
    aborted: toolUseContext.abortController.signal.aborted,
    messages: messagesForQuery,
    cacheSafeParams: { systemPrompt, userContext, systemContext, ... },
  })

  if (compacted) {
    const postCompactMessages = buildPostCompactMessages(compacted)
    const next: State = {
      messages: postCompactMessages,
      ...
      hasAttemptedReactiveCompact: true,  // ← 标记已尝试
      transition: { reason: 'reactive_compact_retry' },
    }
    state = next
    continue  // ← 用压缩后的历史重试
  }
```

`reactive compact` 是一次真正的 LLM 调用（通常用 Haiku），把当前的历史压缩成摘要。成本更高，但能处理 drain 无法处理的情况（比如根本没有 staged collapse）。

`hasAttemptedReactiveCompact: true` 确保这个操作在一次 query() 调用里只发生一次。如果 reactive compact 后还是 413，就不会再次尝试——直接暴露错误。

## 媒体大小错误的特殊处理

除了 413，还有一类可恢复的错误：**媒体文件过大**（图片或 PDF 超过了 API 的大小限制）。

这类错误走的是稍微不同的路径：

```typescript
const isWithheldMedia =
  mediaRecoveryEnabled &&
  reactiveCompact?.isWithheldMediaSizeError(message)
```

媒体大小错误不走 collapse drain（collapse 不会删除图片），直接尝试 reactive compact。Reactive compact 在处理媒体错误时会从历史里删掉过大的图片/文档，然后重试。

注意 `mediaRecoveryEnabled` 是在进入流式循环前就 hoist 好的：

```typescript
// 进入流式循环前
const mediaRecoveryEnabled = reactiveCompact?.isReactiveCompactEnabled() ?? false
```

为什么要 hoist？因为 `CACHED_MAY_BE_STALE` 的值在 5-30 秒的流式过程中可能会变。Withholding 检查（在流里）和 recovery 检查（流结束后）必须基于同一个 gate 值——如果 gate 在流的过程中从 false 变成了 true，withholding 没有拦截，但 recovery 认为应该处理，被 withhold 的消息就会消失（既没有输出，也没有被恢复）。Hoist 消除了这个时间窗口。

## 自救失败后的处理

如果两级恢复都没能成功：

```typescript
// 没有恢复成功
yield lastMessage          // ← 把被 withhold 的错误消息现在才输出
void executeStopFailureHooks(lastMessage, toolUseContext)
return { reason: isWithheldMedia ? 'image_error' : 'prompt_too_long' }
```

注意：`yield lastMessage` 是在恢复失败后才发生的。在 SDK 集成方看来，它收到了一个错误消息，但在这之前系统已经悄悄尝试了 collapse drain + reactive compact，用了大约 3-10 秒。

从外部看，这整个过程是不可见的——直到最终失败，外层才知道出了问题。

## 面试指导

这个 withholding + 两级恢复的模式，在面试里可以用来回答一类问题：**如何让外部调用方对系统内部的自救过程透明？**

关键点：
1. **在暴露错误之前给自救系统一个窗口**：withhold 错误，不立刻 yield
2. **自救成功时，外层完全感知不到**：外层看到的是一次成功的 response
3. **自救失败时，才把错误暴露出来**：这时候外层收到的是最终无法恢复的错误

这个模式在很多高可用系统里都有体现：数据库的自动 failover、CDN 的 origin retry、服务网格的 circuit breaker。共同的原则是：**先内部消化，再向外部报告**。

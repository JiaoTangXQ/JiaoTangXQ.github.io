---
title: "autocompact 的触发阈值、熔断机制和 session memory 优先路径"
slug: "168-autocompact"
date: 2026-04-09
topics: [上下文管理, 自动化, 会话连续性]
importance: 0.9
---

# autocompact 的触发阈值、熔断机制和 session memory 优先路径

面试题形式：**Claude Code 的 autocompact 什么时候触发？失败三次后会发生什么？**

## 有效上下文窗口的计算

autocompact 的阈值基于「有效上下文窗口」，而不是模型标称的最大 token 数：

```ts
export function getEffectiveContextWindowSize(model: string): number {
  const reservedTokensForSummary = Math.min(
    getMaxOutputTokensForModel(model),
    MAX_OUTPUT_TOKENS_FOR_SUMMARY, // 20_000
  )
  let contextWindow = getContextWindowForModel(model, getSdkBetas())
  // 环境变量可覆盖，便于测试
  if (process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) { ... }
  return contextWindow - reservedTokensForSummary
}
```

为什么要预留 20,000 tokens？因为压缩摘要本身需要输出 token，p99.99 的摘要输出长度是 17,387 tokens。如果不预留，压缩时模型可能因为输出空间不足而截断摘要。

autocompact 触发阈值再从有效窗口中再减去 `AUTOCOMPACT_BUFFER_TOKENS`（13,000），留出额外缓冲：

```ts
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000

export function getAutoCompactThreshold(model: string): number {
  return getEffectiveContextWindowSize(model) - AUTOCOMPACT_BUFFER_TOKENS
}
```

## shouldAutoCompact 的四重 guard

在真正计算 token 数之前，`shouldAutoCompact()` 先过四道防线：

**1. Recursion guard**：如果当前 `querySource` 是 `'session_memory'` 或 `'compact'`，直接返回 false。这两种来源本身是子 agent，如果它们自己也触发 autocompact，会造成无限递归。

**2. Context collapse guard**：如果 `isContextCollapseEnabled()`，也返回 false。Context collapse 是另一套上下文管理机制（commit at 90%，block at 95%），autocompact 的触发点（约 93% effective）正好夹在两者之间，如果不隔离会产生竞争条件。

**3. Reactive compact gate**：如果 feature flag `tengu_cobalt_raccoon` 开启，说明是 reactive-only 模式，只在 API 返回 413 后才压缩，不做主动 autocompact。

**4. `isAutoCompactEnabled()` 检查**：读取用户配置和 `DISABLE_AUTO_COMPACT` 环境变量。

## 熔断器：连续失败三次就停止

```ts
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

if (
  tracking?.consecutiveFailures !== undefined &&
  tracking.consecutiveFailures >= MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES
) {
  return { wasCompacted: false }
}
```

为什么需要熔断？真实数据：2026-03-10 统计中，有 1,279 个 session 出现了 50 次以上的连续失败（最多 3,272 次），每天浪费约 25 万次 API 调用。根本原因是当上下文已经不可恢复地超限（比如遇到 `prompt_too_long` 错误），每次 autocompact 尝试都注定失败，但没有熔断的话会在每一个 turn 重试。

## session memory 优先路径

autocompact 触发后，并不是直接调用 `compactConversation()`（全量摘要替换），而是**先尝试 session memory compaction**：

```ts
const sessionMemoryResult = await trySessionMemoryCompaction(
  messages,
  toolUseContext.agentId,
  recompactionInfo.autoCompactThreshold,
)
if (sessionMemoryResult) {
  // session memory 路径：只截断消息，保留 session notes
  setLastSummarizedMessageId(undefined)
  runPostCompactCleanup(querySource)
  return { wasCompacted: true, compactionResult: sessionMemoryResult }
}
```

session memory compaction 比全量压缩「轻」：它不需要再跑一个 forked agent 生成摘要，而是利用已有的 session notes 文件（`~/.claude/projects/.../session_memory.md`）重建上下文。只有当 session memory 为空或者内容不足时，才退回全量 `compactConversation()`。

## 面试要点

**Q：如果用户设置了 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=50000`，会发生什么？**

这个环境变量会覆盖 `getContextWindowForModel()` 的返回值，让系统认为上下文窗口只有 50,000 tokens，从而让 autocompact 更早触发。主要用于测试，生产环境不建议设置。

**Q：autocompact 成功后，为什么要调用 `runPostCompactCleanup()`？**

压缩后大量缓存失效：`getUserContext()` 的 memoize 缓存、`getMemoryFiles()` 的文件缓存、bash 的 speculative check 结果、分类器的审批记录等。如果不清理，下一个 turn 可能从旧缓存读到压缩前的状态。

**Q：`recompactionInfo.isRecompactionInChain` 有什么用？**

它告诉 `compactConversation()` 这次压缩是否是上一次压缩后紧接着又压缩（chain 中）。如果是，摘要提示词会稍作调整，避免摘要内容和上一次摘要的开头重复。这个字段的值由 `tracking?.compacted === true` 决定，而 `tracking` 在每次 autocompact 成功后会更新。

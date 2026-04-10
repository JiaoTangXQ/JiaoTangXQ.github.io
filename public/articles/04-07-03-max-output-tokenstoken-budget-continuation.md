---
title: "代码考古：max output tokens 的三段恢复逻辑是怎么演化出来的？"
slug: "04-07-03-max-output-tokenstoken-budget-continuation"
date: 2026-04-09
topics: [主循环]
summary: "模型输出被截断（max_output_tokens）有三段恢复逻辑，顺序很关键：先升级输出限制，再注入续写提示，最多恢复 3 次。Token budget continuation 是完全不同的机制，处理的是「预算控制」而不是「输出截断」。两者很容易混淆。"
importance: 1
---

# 代码考古：max output tokens 的三段恢复逻辑是怎么演化出来的？

## 两种「继续」的根本差异

先厘清概念。

**Max output tokens 续写**：模型在回答时被硬截断——token 槽用完了，API 强制停止了输出。表现是 response 里的 `stop_reason === 'max_tokens'`，而不是正常完成的 `'end_turn'`。这是一次**不完整的输出**，需要让模型接着说。

**Token budget continuation**：模型正常完成了这一轮输出（stop_reason === 'end_turn'），但系统检查发现整个 agentic turn（从用户提出任务开始，到当前）已经消耗了大量 token，但按预算还有余量。系统决定**主动继续**，注入 nudge 消息让模型做更多工作。这是一个**主动延伸**，不是修复中断。

两者在代码里走的是完全不同的路径：

```
Max output tokens:
  isWithheldMaxOutputTokens(lastMessage) === true
  → 恢复逻辑（escalate / multi-turn recovery）

Token budget:
  needsFollowUp === false（模型正常结束）
  → checkTokenBudget(budgetTracker, ...) 返回 { action: 'continue' }
  → 注入预算 nudge 消息
```

## Max Output Tokens 的三段恢复

### 第一段：先 Withhold

和 413 类似，max_output_tokens 错误先被 withhold：

```typescript
function isWithheldMaxOutputTokens(msg: Message): msg is AssistantMessage {
  return msg?.type === 'assistant' && msg.apiError === 'max_output_tokens'
}

// 流式循环里
if (isWithheldMaxOutputTokens(message)) {
  withheld = true
}
```

为什么要 withhold？因为 SDK 集成方（cowork/desktop）在收到 `error` 字段的消息时会终止会话。如果立刻暴露截断错误，用户就需要重新开始，所有进度丢失。

### 第二段：Escalate（OTK slot）

```typescript
const capEnabled = getFeatureValue_CACHED_MAY_BE_STALE('tengu_otk_slot_v1', false)

if (
  capEnabled &&
  maxOutputTokensOverride === undefined &&   // ← 只 escalate 一次
  !process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS // ← 不覆盖用户的手动设置
) {
  const next: State = {
    messages: messagesForQuery,  // ← 相同的消息，不添加任何内容
    ...
    maxOutputTokensOverride: ESCALATED_MAX_TOKENS,  // ← 升级到 64k
    transition: { reason: 'max_output_tokens_escalate' },
  }
  state = next
  continue  // ← 用相同的消息、更大的输出限制重试
}
```

这是最轻量的恢复：不修改任何消息，只是把下一次 API 调用的 `max_output_tokens` 参数升级到 `ESCALATED_MAX_TOKENS`（64k）。

逻辑是：也许模型只是需要更多输出空间，默认 8k 不够，64k 可能够。重试一次，如果 64k 也被截断，再走下一段。

`maxOutputTokensOverride === undefined` 防止这个 escalate 触发两次（第一次 escalate 到 64k，如果还是被截断，`maxOutputTokensOverride` 已经是 `ESCALATED_MAX_TOKENS` 而不是 `undefined`，不会再次 escalate）。

### 第三段：Multi-turn Recovery（消息注入）

如果 escalate 也不够（或者 escalate 功能未开启）：

```typescript
const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3

if (maxOutputTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
  const recoveryMessage = createUserMessage({
    content:
      `Output token limit hit. Resume directly — no apology, no recap of what you were doing. ` +
      `Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.`,
    isMeta: true,
  })

  const next: State = {
    messages: [
      ...messagesForQuery,
      ...assistantMessages,  // ← 包含截断的半截回答
      recoveryMessage,       // ← 新增的恢复指令
    ],
    ...
    maxOutputTokensRecoveryCount: maxOutputTokensRecoveryCount + 1,
    maxOutputTokensOverride: undefined,  // ← 重置 override，让下一轮用默认值
    transition: { reason: 'max_output_tokens_recovery', attempt: maxOutputTokensRecoveryCount + 1 },
  }
  state = next
  continue
}
```

这里有几个值得注意的设计细节：

**恢复提示的措辞**：`"Resume directly — no apology, no recap"` 是经过调试的指令。如果不加这些约束，模型往往会先道歉（"I'm sorry my previous response was cut off..."），然后重述一遍已经说过的内容，然后才接着继续——这会再次消耗大量 token，可能触发下一次截断。措辞直接告诉模型"不要这些，直接接着"。

**`isMeta: true`**：这条消息不会在 UI 里显示给用户，只对模型可见。用户不会看到"Output token limit hit"这样的系统级消息。

**最多 3 次**：`MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3`。3 次恢复后如果还是被截断，说明这个任务的输出需求超出了当前配置，继续恢复只会浪费时间和金钱。

**为什么加入截断的半截回答**：`...assistantMessages` 包含了截断的 assistant 消息。模型需要看到自己之前写了什么，才能从正确的地方继续。

## Token Budget Continuation：完全不同的机制

Token budget 是一个**主动控制机制**，不是恢复机制。

```typescript
// tokenBudget.ts
const COMPLETION_THRESHOLD = 0.9   // 使用了 90% 的预算就算完成
const DIMINISHING_THRESHOLD = 500  // 连续两次增量 < 500 tokens 算边际效益递减

export function checkTokenBudget(
  tracker: BudgetTracker,
  agentId: string | undefined,
  budget: number | null,
  globalTurnTokens: number,
): TokenBudgetDecision {
  if (agentId || budget === null || budget <= 0) {
    return { action: 'stop', completionEvent: null }  // 子 agent 不参与 budget
  }

  const pct = Math.round((turnTokens / budget) * 100)

  const isDiminishing =
    tracker.continuationCount >= 3 &&
    deltaSinceLastCheck < DIMINISHING_THRESHOLD &&
    tracker.lastDeltaTokens < DIMINISHING_THRESHOLD

  if (!isDiminishing && turnTokens < budget * COMPLETION_THRESHOLD) {
    // 预算还有余量，继续
    return {
      action: 'continue',
      nudgeMessage: getBudgetContinuationMessage(pct, turnTokens, budget),
      ...
    }
  }

  // 达到阈值或边际效益递减，停止
  return { action: 'stop', ... }
}
```

`getBudgetContinuationMessage()` 生成的 nudge 消息根据完成百分比有不同的措辞：

- 30%：温和提醒（还有很多预算，慢慢来）
- 60%：中等提醒（已经用了一半预算了）
- 85%：强烈提醒（快到上限了，要收尾）

**边际效益递减检测**：如果连续 3 轮，每轮新增的 token 消耗都不到 500，说明模型可能陷入了无意义的循环（每轮都在重复类似的内容）。即使预算还有余量，也会停止。这防止了"系统一直 nudge 但模型其实没有在做有意义的工作"的情况。

**为什么子 agent 不参与 budget**：`if (agentId)` 直接返回 stop。子 agent 有自己的 token 预算追踪逻辑，让主线程的 budget check 影响子 agent 会导致嵌套计算混乱。

## 面试指导

这两个机制放在一起，是一道很好的面试题：**如何设计一个 LLM Agent 的输出续写机制？**

一个完整的回答需要区分三种"继续"的场景：

1. **被截断的输出**：max_output_tokens，需要注入"接着说"的指令，措辞要精准（不要道歉，不要重述）
2. **短 token 槽的扩容**：先试试给更大的输出空间，这比多轮对话更便宜
3. **主动预算管理**：根据任务完成比例判断要不要继续做更多工作，需要边际效益递减检测防止无意义循环

能说出这三种区别并解释它们之间的关系，是一个深度的回答。

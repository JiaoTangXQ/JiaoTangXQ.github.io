---
title: "系统设计：如何让一个复杂状态机的「为什么继续」始终可解释？"
slug: "04-08-04-transition"
date: 2026-04-09
topics: [主循环]
summary: "query() 是一个 while(true) 循环，有十几个 continue 点。大多数系统用 boolean flag 或直接 continue 来控制跳转——这在简单场景里够用，但当循环有十几种继续理由时，boolean flag 会变成一团难以调试的状态糊。transition.reason 是 Claude Code 对这个问题的系统性答案。"
importance: 1
---

# 系统设计：如何让一个复杂状态机的「为什么继续」始终可解释？

## 问题的规模

`query()` 主循环有多少个 continue 点？数一数：

1. 流式 fallback 切换（`continue` 后用新模型重试）
2. Collapse drain retry（上下文折叠后重试）
3. Reactive compact retry（应急压缩后重试）
4. Max output tokens escalate（升级输出限制重试）
5. Max output tokens recovery（注入续写提示）× 最多 3 次
6. Stop hook blocking（hook 阻塞注入错误）
7. Token budget continuation（预算有余量继续）
8. 正常的 next_turn（工具执行后继续）

8 类 continue，每类有不同的状态保留规则：
- reactive compact 设 `hasAttemptedReactiveCompact: true`（防止重复触发）
- stop hook blocking 保留 `hasAttemptedReactiveCompact`（防止循环）
- max output tokens recovery 递增 `maxOutputTokensRecoveryCount`（限制次数）
- max output tokens escalate 设 `maxOutputTokensOverride`（避免重复 escalate）
- collapse drain retry 带 `transition.reason === 'collapse_drain_retry'`（只允许一次 drain）

如果用 boolean flags 管理这些状态，代码看起来是这样的：

```typescript
// boolean flags 方案（假设）
let shouldRetry = false
let didCompact = false
let escalatedTokens = false
let hookWasActive = false
let recoveryCount = 0

// 循环里
if (isMaxOutputTokens && !escalatedTokens) {
  escalatedTokens = true
  shouldRetry = true
}
if (isMaxOutputTokens && escalatedTokens && recoveryCount < 3) {
  recoveryCount++
  shouldRetry = true
}
if (is413 && !didCompact) {
  didCompact = true
  shouldRetry = true
}
// ...更多 flag 组合
```

这些 flag 之间的交互关系是隐式的。想弄清楚"现在为什么在继续"，需要同时检查 `shouldRetry`、`didCompact`、`escalatedTokens`、`hookWasActive` 的值，以及它们是在什么时候被设置的。

## Claude Code 的方案：显式的 transition.reason

```typescript
type State = {
  messages: Message[]
  toolUseContext: ToolUseContext
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  maxOutputTokensOverride: number | undefined
  pendingToolUseSummary: Promise<ToolUseSummaryMessage | null> | undefined
  stopHookActive: boolean | undefined
  turnCount: number
  transition: Continue | undefined   // ← 这里
}
```

`Continue` 类型携带 reason 和可选的上下文数据：

```typescript
type Continue = {
  reason: 
    | 'next_turn'
    | 'collapse_drain_retry'
    | 'reactive_compact_retry'
    | 'max_output_tokens_escalate'
    | 'max_output_tokens_recovery'
    | 'stop_hook_blocking'
    | 'token_budget_continuation'
  attempt?: number     // max_output_tokens_recovery 时的尝试次数
  committed?: number   // collapse_drain_retry 时提交了多少折叠
}
```

每个 continue 点都设置一个明确的 reason：

```typescript
// 例：max output tokens recovery
const next: State = {
  // ...其他状态字段
  transition: {
    reason: 'max_output_tokens_recovery',
    attempt: maxOutputTokensRecoveryCount + 1,
  },
}
state = next
continue
```

## transition.reason 的三个用途

### 用途 1：让循环的防护条件可读

有些 continue 路径有"只能走一次"的限制：

```typescript
// collapse drain retry 的防护
if (
  feature('CONTEXT_COLLAPSE') &&
  contextCollapse &&
  state.transition?.reason !== 'collapse_drain_retry'  // ← 读取 transition.reason
) {
  const drained = contextCollapse.recoverFromOverflow(...)
  if (drained.committed > 0) {
    state = { ..., transition: { reason: 'collapse_drain_retry', committed: drained.committed } }
    continue
  }
}
```

`state.transition?.reason !== 'collapse_drain_retry'` 比 `!hasTriedDrain`（一个额外的 boolean flag）更清晰——它明确说的是"如果上一轮就是因为 drain 才继续的，这次就不要再 drain 了"。

### 用途 2：测试可以不解析消息内容就断言执行路径

这是最重要的用途，也是源码注释里明确提到的：

> Lets tests assert recovery paths fired without inspecting message contents.

一个测试想验证"max output tokens recovery 触发了"，有两种方式：

```typescript
// 方式 A：解析消息内容（脆弱）
expect(messages.some(m =>
  m.type === 'user' &&
  m.message.content.some(c =>
    c.type === 'text' &&
    c.text.includes('Output token limit hit')
  )
)).toBe(true)

// 方式 B：检查 transition（稳健）
expect(state.transition?.reason).toBe('max_output_tokens_recovery')
expect(state.transition?.attempt).toBe(2)
```

方式 A 依赖具体的文本内容。如果有人修改了恢复提示的措辞（完全合理的改动），测试就会失败。方式 B 依赖的是执行路径的语义，与具体措辞无关。

### 用途 3：日志和可观测性

```typescript
logForDebugging(
  `Token budget continuation #${decision.continuationCount}: ${decision.pct}% (${decision.turnTokens.toLocaleString()} / ${decision.budget.toLocaleString()})`,
)
```

当生产环境出现"为什么这个会话一直在跑"的问题时，查看 `transition.reason` 的序列（`next_turn → next_turn → token_budget_continuation → token_budget_continuation → stop_hook_blocking → ...`）比看一堆 boolean flag 的状态要直观得多。

## transition vs 直接递归调用

有一种更简单的实现：不用显式的 State 和 transition，直接用递归：

```typescript
async function* queryLoop(params, depth = 0) {
  // ...
  if (needsMaxOutputTokensRecovery) {
    yield* queryLoop({ ...params, recoveryMessage }, depth + 1)
    return
  }
  // ...
}
```

递归很简洁，但有几个问题：

1. **调用栈会增长**：如果有多次 max output tokens recovery + token budget continuation + stop hook blocking，调用栈可能达到 10-20 层
2. **状态共享复杂**：递归间共享状态需要通过参数传递，容易出错
3. **调试困难**：stack trace 里看到的是调用层级，不是"为什么继续"的语义

`while(true) + state + transition` 的方案把"为什么继续"变成了数据，而不是调用层级。调试时检查 `state.transition`，比数调用栈层级更直观。

## 面试指导

这道题的通用版本是：**如何设计一个复杂状态机让它保持可维护性？**

Claude Code 的 transition.reason 提供了一个具体答案：

1. **让状态转移的原因成为一等公民**：不用 boolean flag，用枚举类型的 reason
2. **原因携带上下文数据**：`attempt`, `committed` 等字段让 reason 不只是标签，还是完整的诊断信息
3. **循环防护条件用 reason 写**：`state.transition?.reason !== 'collapse_drain_retry'` 比 `!hasTriedDrain` 更清晰
4. **测试用 reason 断言**：不依赖具体文本内容

如果你在面试中被问到"如何让一个有 10+ 个 continue 点的循环保持可理解"，transition.reason 这个模式是一个可以直接引用的具体答案。

更通用的原则是：**当"继续的理由"有多种类型时，把类型显式化——用枚举而不是布尔值，用携带上下文的对象而不是 flag 组合。**

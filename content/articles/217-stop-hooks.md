---
title: "stop hooks 阻塞时如何改写主循环去向？"
slug: "217-stop-hooks"
date: 2026-04-09
topics: [Claude Code 源码, hooks, 主循环]
importance: 0.9
---

# stop hooks 阻塞时如何改写主循环去向？

## 面试场景

面试官：「你们系统里 stop hook 如果返回了阻塞错误，会发生什么？」

很多人的第一反应是：「整轮失败、报错退出」。这个答案说明没读过 Claude Code 的主循环实现。

正确答案更有趣：**stop hook 的阻塞本身会被编码进 transition，成为下一轮的起点**。

## 源码链路

`query.ts` 里有个专门处理 stop hooks 的函数 `handleStopHooks()`，位于 `src/query/stopHooks.ts`：

```typescript
// src/query/stopHooks.ts
export async function* handleStopHooks(
  messagesForQuery: Message[],
  assistantMessages: AssistantMessage[],
  systemPrompt: SystemPrompt,
  // ...
): AsyncGenerator<..., StopHookResult>
```

它的返回类型是 `StopHookResult`：

```typescript
type StopHookResult = {
  blockingErrors: Message[]
  preventContinuation: boolean
}
```

关键在 `query.ts` 里对这个结果的处理。stop hooks **只在拿到有效 assistant 响应后才运行**——如果最后一条消息其实是 API error，系统会直接跳过 hooks。

当 `blockingErrors` 非空时，系统会把阻塞错误追加进 `messages`，再把 `transition.reason` 设成 `stop_hook_blocking`，触发下一轮——而不是终止会话。

这意味着阻塞不是终结，而是给下一轮补前提。

## transition.reason 的语义

`State.transition.reason` 是 Claude Code 主循环的核心状态机字段。合法取值包括：

- `next_turn` — 正常推进
- `collapse_drain_retry` — 上下文折叠排干后重试
- `reactive_compact_retry` — 响应式压缩后重试
- `max_output_tokens_escalate` — 输出超限，先尝试提升上限
- `max_output_tokens_recovery` — 输出超限恢复
- `stop_hook_blocking` — stop hook 阻塞，下一轮继续处理
- `token_budget_continuation` — token 预算续写

每个 `reason` 都对应一种不同的继续语义。普通做法是用布尔位 `shouldContinue = true/false`，但这里要知道的不只是「继续不继续」，而是「为什么继续」——不同原因对应的下一轮行为并不相同。

## 与普通 hook 设计的区别

普通的前后置 hook 设计里，hook 失败 = 整件事失败。Claude Code 不这么做的原因：

**制度层失败不只是日志，它本身就能改写去向。**

stop hook 代表的是「系统的最后一道验证」。如果这道验证失败了，最合理的行为是：把失败原因告诉下一轮，让模型有机会响应——而不是静默丢弃或直接崩溃。

这也是为什么 stop hook 的阻塞错误会被 `yield` 出来追加进 `messages`，而不是只记一条日志。

## 调试 stop hook 阻塞的难点

理解这个机制对调试很关键：

1. `stop_hook_blocking` 触发的下一轮，模型会看到阻塞错误作为上一轮的「结果」
2. 如果 hook 持续阻塞，循环可能会连续多轮跑 stop hook，最终触发 `maxTurns` 退出
3. 调试时要分清「我的 hook 返回了什么」和「主循环把它放到哪里了」

Hook 不再是独立的前后置插件，它与主循环状态机互相理解。这是复杂度上升的代价，也是长期运行系统应有的设计。

## 面试指导

被问「你们的 hook 系统怎么设计的」时，可以用这个案例说明：**hook 的失败路径和成功路径同样重要**。成功路径好做，失败路径决定系统能不能在生产中稳住。

Claude Code 的 stop hook 设计体现了一个原则：制度层的失败结果本身就是信息，应该被编码进系统状态，而不是作为例外情况扔掉。

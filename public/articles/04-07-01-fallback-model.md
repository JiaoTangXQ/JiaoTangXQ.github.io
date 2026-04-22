---
title: "故障恢复分析：模型切换后如何防止孤儿工具结果污染新会话？"
slug: "04-07-01-fallback-model"
date: 2026-04-09
topics: [主循环]
importance: 1
---

# 故障恢复分析：模型切换后如何防止孤儿工具结果污染新会话？

## 问题的根源：流式输出 + 工具并发执行

当你的 API 请求触发模型 fallback 时，典型的状态是：

```
流式执行中...
[已输出: assistant 消息片段]
[已输出: tool_use block 1]   ← 工具已经在后台执行了
[模型: 继续输出...]
[FallbackTriggeredError] ← 主模型不可用了
```

这时候，系统处于一个部分执行的状态：
- `assistantMessages` 里已经有了一条或多条消息
- `StreamingToolExecutor` 里有已经开始执行的工具
- 这些工具会用旧的 `tool_use_id`（比如 `toolu_abc123`）完成执行

如果用新模型直接重试，会发生什么？

新模型会产生新的 tool_use 块，使用新的 `tool_use_id`（比如 `toolu_xyz789`）。但旧工具的结果还挂在那里，对应着 `toolu_abc123`。这两组 id 不匹配，transcript 里会有孤儿 `tool_result`，API 调用会报错（每个 `tool_use` 必须对应一个 `tool_result`）。

## Claude Code 的清理步骤

`query()` 在捕获到 `FallbackTriggeredError` 后，会执行一套完整的清理：

```typescript
catch (innerError) {
  if (innerError instanceof FallbackTriggeredError && fallbackModel) {
    // Step 1: 为已经输出的半截消息生成 tombstone
    for (const msg of assistantMessages) {
      yield { type: 'tombstone' as const, message: msg }
    }
    
    // Step 2: 清空本轮积累的状态
    assistantMessages.length = 0
    toolResults.length = 0
    toolUseBlocks.length = 0
    needsFollowUp = false
    
    // Step 3: 丢弃旧执行器，新建一个
    if (streamingToolExecutor) {
      streamingToolExecutor.discard()
      streamingToolExecutor = new StreamingToolExecutor(...)
    }
    
    // Step 4: 切换到 fallback 模型
    currentModel = fallbackModel
    toolUseContext.options.mainLoopModel = fallbackModel
    
    // Step 5: 剥掉 model-bound 的 thinking signature
    if (process.env.USER_TYPE === 'ant') {
      messagesForQuery = stripSignatureBlocks(messagesForQuery)
    }
    
    // Step 6: 发出用户可见的通知
    yield createSystemMessage(
      `Switched to ${renderModelName(innerError.fallbackModel)} due to high demand...`,
      'warning',
    )
    
    // Step 7: 在同一轮里用新模型重试
    attemptWithFallback = true
    continue
  }
}
```

每一步都有具体的理由。

## Step 1 & 2：Tombstone 和清空状态

**Tombstone** 是一种特殊的消息类型：

```typescript
yield { type: 'tombstone' as const, message: msg }
```

它告诉 UI 层："把这条消息从显示里删掉"。为什么需要这个？

因为流式输出期间，这些半截消息已经被 `yield` 出去了，UI 已经在展示它们了。仅仅清空 `assistantMessages` 数组不会改变 UI 的显示状态。tombstone 是一个明确的"撤销"信号。

注释里对原因的说明很清楚：

> These partial messages (especially thinking blocks) have invalid signatures that would cause "thinking blocks cannot be modified" API errors.

thinking block 有一个加密签名（signature），是模型产出时生成的，用来验证这段 thinking 内容没有被篡改。如果把这段 thinking 用于新的 API 调用（不同模型），签名验证会失败，API 会拒绝这个请求。

## Step 3：丢弃 StreamingToolExecutor

```typescript
streamingToolExecutor.discard()
streamingToolExecutor = new StreamingToolExecutor(...)
```

`discard()` 告诉执行器停止一切正在进行的工具执行，并静默丢弃所有结果。

为什么不能让已经在跑的工具继续跑完再丢弃结果？

因为 `discard()` 主要阻止的是**结果 yield**——工具本身可能已经在操作系统层面执行了（比如一个 Bash 命令已经开始跑了），`discard()` 无法让这个进程回滚。但它阻止了这些结果出现在主循环的输出流里，防止旧 `tool_use_id` 的结果混入新模型的会话。

新建一个 `StreamingToolExecutor` 确保新模型的工具执行是干净的，没有任何旧状态。

## Step 5：剥掉 thinking signature

```typescript
if (process.env.USER_TYPE === 'ant') {
  messagesForQuery = stripSignatureBlocks(messagesForQuery)
}
```

这只对 Anthropic 内部用户启用，因为 thinking blocks（扩展思考模式）目前主要是内部特性。

当主模型使用了 extended thinking（产出了 thinking 块），这些 thinking 块会有与该模型绑定的签名。切换到 fallback 模型时，旧的 thinking 块签名对 fallback 模型无效。

`stripSignatureBlocks` 会从 `messagesForQuery` 里删掉所有带 signature 的 thinking block，让 fallback 模型拿到一段干净的历史。代价是失去了这部分 thinking 历史，但这是切换模型时不可避免的信息损失。

## 为什么在同一轮里重试，而不是报错让用户重发？

这是 fallback 设计的核心哲学。

**报错让用户重发**的方案：
- 用户看到错误："主模型暂时不可用，请重试"
- 用户需要重新发送消息
- 本轮积累的所有工具历史（已读的文件、已执行的搜索）全部丢失
- 用户体验：中断

**同一轮内部切换**的方案：
- 用户看到警告："已切换到备用模型（因主模型高负载）"
- 用户什么都不需要做
- `messagesForQuery` 保留了完整的会话历史（只清掉了这轮已输出的半截内容）
- 用户体验：透明

源码里 `logEvent('tengu_model_fallback_triggered', ...)` 和 `yield createSystemMessage(...)` 的配合，确保了对用户是 warning 级别的通知，而不是 error 级别的中断。

## 边界条件

**Q：如果 fallback 模型也不可用怎么办？**

`attemptWithFallback` 只在第一次 `FallbackTriggeredError` 时被设为 `true`，重试循环结束后回到 `false`。如果 fallback 模型也触发了 `FallbackTriggeredError`，会再次 `throw innerError`，这次 `fallbackModel` 已经是新模型，不会有第二次 fallback——错误会传播到外层 catch。

**Q：如果流式执行时工具已经开始跑，discard 来得及阻止吗？**

`discard()` 本质上是设一个标志，让后续的 `getCompletedResults()` 和 `getRemainingResults()` 不再 yield 结果。已经在 OS 层面执行中的 Bash 命令无法被阻止，但它的结果不会出现在新模型的输入里。这是一个"无法回滚"的情况，系统选择了"至少保证 transcript 干净"。

## 面试指导

Fallback 模型设计的面试考点：

1. **状态清理的完整性**：切换模型不是换个参数重发请求，而是需要清除所有与旧模型绑定的状态（tombstone、旧执行器、thinking signature）
2. **用户体验的连续性**：目标是对用户透明，不是让用户重新开始
3. **不可回滚的副作用**：已经执行的 Bash 命令无法回滚，系统只能保证 transcript 干净，接受物理世界的不确定性

第三点是生产级 Agent 设计里最难处理的部分——工具执行的副作用可能已经改变了真实世界，而模型的重试是在一个被改变过的环境里运行的。

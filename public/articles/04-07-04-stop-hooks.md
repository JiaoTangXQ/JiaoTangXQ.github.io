---
title: "画图讲解：stop hooks 的执行流程和阻塞状态机"
slug: "04-07-04-stop-hooks"
date: 2026-04-09
topics: [主循环]
summary: "stop hooks 在 Claude Code 里不是简单的「回调函数」，而是主循环状态机的一个关口。它们可以产生阻塞错误（让模型重新来过）、可以阻止 continuation（强制停止）、可以静默通过。理解这个三向分叉，才能真正理解 stop hooks 为什么这么设计。"
importance: 1
---

# 画图讲解：stop hooks 的执行流程和阻塞状态机

## Stop Hooks 在主循环中的位置

Stop hooks 在 `query()` 主循环的末尾执行——在模型输出完成、工具执行结束之后，在循环决定是否继续之前：

```
query() 主循环的一次迭代:
  ┌─────────────────────────────────────────┐
  │ 1. 调用模型 API（流式）                   │
  │ 2. 收集 assistant 消息和 tool_use 块      │
  │ 3. 执行工具（并发/串行）                  │
  │ 4. 收集 tool_result                      │
  │ 5. 检查恢复路径（413, max_output, ...）   │
  │                                          │
  │ → 如果需要继续工具轮次: continue          │
  │ → 如果没有 tool_use: 进入 stop hooks     │ ← 这里
  └─────────────────────────────────────────┘
            ↓
  handleStopHooks()
```

**关键**：stop hooks 只在模型没有输出 `tool_use` 块（`!needsFollowUp`）时执行。工具轮次期间不执行 stop hooks——每轮工具执行完都去跑 hooks 太慢，而且工具还没完全执行完时的"结果"对 hooks 没有意义。

还有一个重要的前置检查：

```typescript
// 如果最后一条消息是 API 错误，跳过 stop hooks
if (lastMessage?.isApiErrorMessage) {
  void executeStopFailureHooks(lastMessage, toolUseContext)
  return { reason: 'completed' }
}
```

为什么要跳过？注释里写得很清楚：

> Skip stop hooks when the last message is an API error. The model never produced a real response — hooks evaluating it create a death spiral: error → hook blocking → retry → error → …

模型连有效回答都没有产出，stop hook 拿什么来评估？如果 hook 检查"模型的输出是否符合规范"，而模型的输出是一个 API 错误，hook 很可能会报错（"不符合规范"），导致循环：API 错误 → hook 阻塞 → 重试 → API 错误 → ...

## Stop Hooks 的三向分叉

`handleStopHooks()` 返回 `{ blockingErrors, preventContinuation }`，主循环根据这个结果走三条不同的路：

```
handleStopHooks() 返回
         │
         ├─ preventContinuation === true
         │   └─ return { reason: 'stop_hook_prevented' }
         │      （会话结束，不是错误，是 hook 主动要求停止）
         │
         ├─ blockingErrors.length > 0
         │   └─ state = {
         │        messages: [...messagesForQuery, ...assistantMessages, ...blockingErrors],
         │        stopHookActive: true,
         │        transition: { reason: 'stop_hook_blocking' }
         │      }
         │      continue  （带着阻塞信息重新进入循环）
         │
         └─ 两者都不满足
             └─ 正常继续（检查 token budget 等后续逻辑）
```

### PreventContinuation：强制停止

这是 stop hook 最强的控制能力——直接终止整个会话，不给模型重来的机会：

```typescript
// 在 handleStopHooks 里
if (result.preventContinuation) {
  preventedContinuation = true
  stopReason = result.stopReason || 'Stop hook prevented continuation'
  yield createAttachmentMessage({
    type: 'hook_stopped_continuation',
    message: stopReason,
    ...
  })
}

// 最终
if (preventedContinuation) {
  return { blockingErrors: [], preventContinuation: true }
}
```

主循环收到这个结果：

```typescript
const stopHookResult = yield* handleStopHooks(...)

if (stopHookResult.preventContinuation) {
  return { reason: 'stop_hook_prevented' }
}
```

什么场景会用到 preventContinuation？比如：安全检查 hook 发现模型输出了危险内容，或者任务管理 hook 认为这个任务已经完成不需要继续。

### Blocking Errors：让模型知道哪里出了问题

```typescript
if (stopHookResult.blockingErrors.length > 0) {
  const next: State = {
    messages: [
      ...messagesForQuery,
      ...assistantMessages,
      ...stopHookResult.blockingErrors,  // ← 写入阻塞错误
    ],
    toolUseContext,
    autoCompactTracking: tracking,
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact,         // ← 注意：保留这个值！
    maxOutputTokensOverride: undefined,
    stopHookActive: true,                // ← 标记 hook 正在活跃
    transition: { reason: 'stop_hook_blocking' },
  }
  state = next
  continue
}
```

注意 `hasAttemptedReactiveCompact` 的处理。它被**保留**（不重置为 false）。代码注释里专门解释了这个决定：

> Preserve the reactive compact guard — if compact already ran and couldn't recover from prompt-too-long, retrying after a stop-hook blocking error will produce the same result. Resetting to false here caused an infinite loop: compact → still too long → error → stop hook blocking → compact → … burning thousands of API calls.

这是一个真实的历史教训（"caused an infinite loop"），不是理论上的推理。

`stopHookActive: true` 会影响下一轮 stop hooks 的执行方式：

```typescript
const generator = executeStopHooks(
  permissionMode,
  signal,
  undefined,
  stopHookActive ?? false,  // ← 如果是 true，hook 会知道自己是在处理一个重试
  ...
)
```

这允许 hook 实现"第一次阻塞提供详细反馈，第二次阻塞采取更强硬行动"之类的逻辑。

## Stop Hooks 的背景任务

`handleStopHooks()` 在执行阻塞检查之前，还会发射一些**非阻塞的背景任务**：

```typescript
if (!isBareMode()) {
  void executePromptSuggestion(stopHookContext)      // 生成下一轮的提示建议
  void extractMemoriesModule!.executeExtractMemories(...)  // 提取记忆
  void executeAutoDream(stopHookContext, ...)        // 自动 dream 处理
}
```

这些任务是 fire-and-forget——它们的成功或失败不影响主循环的继续。它们用的是 `stopHookContext`（包含完整的会话历史），在一次会话结束的自然停顿点做背景工作。

`--bare` 模式（脚本执行）跳过这些背景任务，因为脚本不需要 auto-memory 或 prompt suggestion，而且这些后台任务会争抢进程退出前的资源。

## TeammateIdle 和 TaskCompleted：多智能体场景

对于 teammate agent（多 agent 协作场景），stop hooks 之后还会运行两类额外的 hooks：

```typescript
if (isTeammate()) {
  // 1. 运行 TaskCompleted hooks（完成了分配给我的哪些任务？）
  for (const task of inProgressTasks) {
    for await (const result of executeTaskCompletedHooks(task.id, ...)) {
      ...
    }
  }
  
  // 2. 运行 TeammateIdle hooks（我现在空闲了，通知队长）
  const teammateIdleGenerator = executeTeammateIdleHooks(...)
  for await (const result of teammateIdleGenerator) {
    ...
  }
}
```

这些 hooks 同样可以产生 `blockingErrors` 和 `preventContinuation`，处理方式和普通 stop hooks 完全相同。

## 面试指导

Stop hooks 是一道很好的"外部约束与系统状态机的集成"面试题。

关键设计点：
1. **Hook 不是简单回调**：hook 的返回值（blockingErrors / preventContinuation）直接影响状态机的下一步转移
2. **错误避让循环**：API 错误时不运行 stop hooks，防止错误 → hook 阻塞 → 重试 → 错误的死循环
3. **状态保护**：`hasAttemptedReactiveCompact` 跨越 stop hook 重试保留，防止不同类型失败互相干扰
4. **渐进式控制**：从轻到重——阻塞错误（给模型反馈）→ preventContinuation（强制停止）

能说出"hook 不是旁观者，而是状态机的参与者"，并解释死循环保护和状态保护的原因，是一个深度的回答。

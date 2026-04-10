---
title: "stop hooks 为什么在回合结束后执行，而不是在生成过程中执行？"
slug: "10-09-01-stophooks"
date: 2026-04-09
topics: [上下文管理]
summary: "整理动作（记忆提炼、auto-dream、compact 后处理）被推迟到回合结束后的 stop hooks 里执行，核心原因是不污染主回合的 token 预算和消息流。"
importance: 1
---

# stop hooks 为什么在回合结束后执行，而不是在生成过程中执行？

这是一道关于异步架构设计的题。面试问法："如果一个 AI Agent 需要在每轮结束后做一些'整理工作'，这些整理工作应该在什么时机执行？"

---

## stop hooks 的调用位置

在 `query.ts` 的主循环里，`handleStopHooks` 被调用的时机非常特定：

```typescript
// query.ts - 当本轮没有工具调用时（模型产生了最终响应）
if (!needsFollowUp) {
  // 主回合已经完成，开始 stop hooks
  const {
    blockingErrors,
    preventContinuation,
  } = yield* handleStopHooks(
    messagesForQuery,
    assistantMessages,
    systemPrompt, userContext, systemContext,
    toolUseContext, querySource,
    stopHookActive,
  )
  // ...
}
```

`needsFollowUp = false` 意味着模型没有发出工具调用，生成了最终的文字回应——**主回合已经落地**。只有在这个时刻，stop hooks 才开始运行。

---

## 在主回合中间执行整理会有什么问题

假设把 `executeExtractMemories` 放在模型生成过程中调用，会发生什么：

**问题 1：token 竞争**

stop hooks 里的后台任务（记忆提炼、auto-dream）本身也是 LLM API 调用，会消耗 token。如果这些调用和主回合同时运行，它们会竞争同一个 token 配额（rate limit），可能导致主回合变慢或失败。

把这些调用推迟到主回合结束后，确保主回合有完整的 token 预算可用。

**问题 2：消息流污染**

如果在主回合流式生成时插入整理操作的消息（比如"正在提炼记忆..."），会打断用户正在看到的输出流。用户体验是：主回应流着流着，突然插入了一条系统消息，然后继续流。这很混乱。

stop hooks 在主回合完全结束之后执行，它们产生的任何 progress 消息都不会和主回应的流混在一起。

**问题 3：状态不一致**

整理操作（比如 compact 后处理）依赖主回合已经完成的状态。如果在生成过程中执行，`assistantMessages` 数组可能还不完整，整理操作看到的是一个中间状态。

---

## stop hooks 的执行内容

`handleStopHooks` 在主回合结束后执行以下内容：

```typescript
// 1. 保存 cache-safe params 供后续使用
if (querySource === 'repl_main_thread' || querySource === 'sdk') {
  saveCacheSafeParams(createCacheSafeParams(stopHookContext))
}

// 2. Job 分类（ant-only，TEMPLATES feature）
// ...

// 3. 后台任务（非 --bare 模式）
if (!isBareMode()) {
  void executePromptSuggestion(stopHookContext)    // 提示建议
  
  if (feature('EXTRACT_MEMORIES') && !toolUseContext.agentId && isExtractModeActive()) {
    void extractMemoriesModule!.executeExtractMemories(...)  // 记忆提炼
  }
  
  if (!toolUseContext.agentId) {
    void executeAutoDream(stopHookContext, ...)  // auto-dream
  }
}

// 4. 用户配置的 Stop hooks
const generator = executeStopHooks(permissionMode, ...)
```

注意前三类任务都用 `void`（fire-and-forget），只有第 4 类（用户配置的 Stop hooks）是 `await`——因为用户的 Stop hooks 可能返回 blocking errors，需要等待它们完成才能决定是否继续。

---

## --bare 模式下的跳过

```typescript
if (!isBareMode()) {
  // 整理任务
}
```

`--bare` 模式（或 `SIMPLE` 环境变量）下，后台整理任务全部跳过。原因：

> Scripted -p calls don't want auto-memory or forked agents contending for resources during shutdown.

在脚本化、非交互的使用场景（比如 `claude -p "执行这个任务"`），会话结束后进程会退出。后台任务竞争资源会导致：
1. 退出变慢（等待后台 API 调用完成）
2. 资源争用（后台任务和主任务同时发 API 调用）
3. 不必要的状态写入（脚本化会话通常不需要长期记忆）

---

## Stop hooks vs post-sampling hooks 的区别

系统有两个"回合后"槽：

**stop hooks（`handleStopHooks`）**：
- 在主回合**完全完成**（没有工具调用，生成了最终回应）时触发
- 可以阻塞继续（`blockingErrors`）
- 可以阻止继续（`preventContinuation`）
- 针对整个"用户轮次"的结束点

**post-sampling hooks（`executePostSamplingHooks`）**：
- 在每次**模型采样**（API 调用）完成后触发
- 不能阻塞
- 更细粒度，包括工具调用轮次的结束
- 是纯观察接口，不影响流程

```typescript
// query.ts 里的调用
await executePostSamplingHooks(
  messagesForQuery,
  systemPrompt, userContext, systemContext,
  toolUseContext, querySource,
)
```

post-sampling hooks 每次 API 调用完成后都会触发，包括工具调用循环中的每一个 API round。stop hooks 只在整个 turn（用户问 → 模型最终回答）结束时触发。

---

## 条件触发：querySource 过滤

stop hooks 里有一些基于 querySource 的过滤：

```typescript
// 只在主线程和 SDK 里保存 cache-safe params
if (querySource === 'repl_main_thread' || querySource === 'sdk') {
  saveCacheSafeParams(...)
}

// 记忆提炼只在主 agent 里运行（不在子 agent）
if (!toolUseContext.agentId && isExtractModeActive()) {
  executeExtractMemories(...)
}

// auto-dream 同样只在主 agent
if (!toolUseContext.agentId) {
  executeAutoDream(...)
}
```

子 agent（AgentTool 启动的 fork）不触发记忆提炼和 auto-dream，因为子 agent 的对话历史只是主 agent 任务的一个子任务，不代表整个会话状态。只有主 agent 看到了完整的用户交互，才有资格做全局性的整理工作。

---

## 面试指导

"整理工作应该什么时候执行"这道题考察的是"主线程和后台任务的时序设计"。

核心论点：
1. **主回合先落地**：用户等待响应，整理工作不应该抢 token、延迟响应
2. **消息流不被污染**：整理的进度消息不插入主回应流
3. **状态完整性**：整理依赖完整的 assistantMessages，必须在生成结束后才有完整输入
4. **fire-and-forget vs blocking**：内部后台任务不等，用户 Stop hooks 要等（因为它们可以阻塞）

能区分"后台任务"和"阻塞 hooks"的不同处理方式，说明你理解了"回合结束"这个时机不是单一的，而是有不同层次的钩子和不同的执行语义。

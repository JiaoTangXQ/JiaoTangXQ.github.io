---
title: "autocompact 的执行流程：从 shouldAutoCompact 到 buildPostCompactMessages"
slug: "10-03-02-autocompact"
date: 2026-04-09
topics: [上下文管理]
importance: 1
---

# autocompact 的执行流程：从 shouldAutoCompact 到 buildPostCompactMessages

这是一道追踪代码执行路径的题。面试官问："当 token 数超过阈值，autocompact 的完整执行链是什么？"

---

## 整体流程图

```
query loop 入口
  ↓
shouldAutoCompact() → false → 跳过，进入正常 API 调用
  ↓ true
trySessionMemoryCompaction()
  ↓ 成功 → 返回轻量结果，跳过 compactConversation
  ↓ 失败
compactConversation()
  ↓
  ├── executePreCompactHooks()
  ├── streamCompactSummary() (forked agent 生成摘要)
  ├── createPostCompactFileAttachments() (重注入文件/plan/skills)
  ├── createCompactBoundaryMessage()
  └── 返回 CompactionResult
  ↓
buildPostCompactMessages(result)
  ↓
继续当前 query，用压缩后的消息流
```

---

## Step 1：session memory 优先路径

`autoCompactIfNeeded()` 在调用 `compactConversation` 之前，先尝试 `trySessionMemoryCompaction()`：

```typescript
const sessionMemoryResult = await trySessionMemoryCompaction(
  messages,
  toolUseContext.agentId,
  recompactionInfo.autoCompactThreshold,
)
if (sessionMemoryResult) {
  // 直接返回，不进入 compactConversation
  setLastSummarizedMessageId(undefined)
  runPostCompactCleanup(querySource)
  return { wasCompacted: true, compactionResult: sessionMemoryResult }
}
```

session memory 压缩路径更轻量——它不需要发一次大的摘要请求给模型，而是利用已有的 session memory 文件来重建上下文。只有当 session memory 路径失败或不适用时，才走 `compactConversation`。

---

## Step 2：compactConversation 的准备阶段

```typescript
export async function compactConversation(
  messages: Message[],
  context: ToolUseContext,
  cacheSafeParams: CacheSafeParams,
  suppressFollowUpQuestions: boolean,
  customInstructions?: string,
  isAutoCompact: boolean = false,
  recompactionInfo?: RecompactionInfo,
): Promise<CompactionResult>
```

进入函数后，首先执行 pre-compact hooks：

```typescript
const hookResult = await executePreCompactHooks(
  { trigger: isAutoCompact ? 'auto' : 'manual', customInstructions },
  context.abortController.signal,
)
// hook 可以注入自定义指令到摘要过程
customInstructions = mergeHookInstructions(customInstructions, hookResult.newCustomInstructions)
```

Pre-compact hooks 给外部用户（比如 CI 系统）提供了一个注入摘要指令的插槽——在 compact 开始之前，可以追加"特别注意保留这部分内容"之类的指令。

---

## Step 3：forked agent 生成摘要

`streamCompactSummary` 用 `runForkedAgent` 启动一个子 agent，传入整个对话历史，让它生成一段摘要。这个调用会继承父会话的 prompt cache，降低摘要的 cache_creation 成本。

一个重要的容错处理是 PTL retry（prompt-too-long retry）：

```typescript
for (;;) {
  summaryResponse = await streamCompactSummary({...})
  summary = getAssistantMessageText(summaryResponse)
  if (!summary?.startsWith(PROMPT_TOO_LONG_ERROR_MESSAGE)) break

  // 摘要请求本身太长了，裁掉最老的消息重试
  ptlAttempts++
  const truncated = ptlAttempts <= MAX_PTL_RETRIES
    ? truncateHeadForPTLRetry(messagesToSummarize, summaryResponse)
    : null
  if (!truncated) throw new Error(ERROR_MESSAGE_PROMPT_TOO_LONG)
  messagesToSummarize = truncated
}
```

有时候 compact 请求本身也会 prompt_too_long——因为要摘要的消息列表太大了。这时候 `truncateHeadForPTLRetry` 会按 API round 粒度丢掉最老的消息，直到摘要请求能通过为止。最多重试 `MAX_PTL_RETRIES = 3` 次。

---

## Step 4：压缩后重注入

摘要生成成功后，系统需要重新注入那些在压缩过程中"消失"的有用内容：

```typescript
const [fileAttachments, asyncAgentAttachments] = await Promise.all([
  createPostCompactFileAttachments(preCompactReadFileState, context, POST_COMPACT_MAX_FILES_TO_RESTORE),
  createAsyncAgentAttachmentsIfNeeded(context),
])
```

常量定义了重注入的预算：
- `POST_COMPACT_MAX_FILES_TO_RESTORE = 5`：最多重注入 5 个文件
- `POST_COMPACT_TOKEN_BUDGET = 50_000`：总 token 预算
- `POST_COMPACT_MAX_TOKENS_PER_FILE = 5_000`：单文件 token 上限
- `POST_COMPACT_MAX_TOKENS_PER_SKILL = 5_000`：单技能 token 上限（技能文件可能很大）
- `POST_COMPACT_SKILLS_TOKEN_BUDGET = 25_000`：技能总预算

工具列表（deferred tools delta）、agent listing、MCP 指令也会在这里重新注入，确保模型在新的上下文里还能"看到"所有可用的工具。

---

## Step 5：buildPostCompactMessages 的消息顺序

```typescript
export function buildPostCompactMessages(result: CompactionResult): Message[] {
  return [
    result.boundaryMarker,         // compact 边界标记（系统消息）
    ...result.summaryMessages,     // 摘要内容（用户消息，isCompactSummary=true）
    ...(result.messagesToKeep ?? []),  // 保留的原始消息（partial compact 路径）
    ...result.attachments,         // 重注入的文件/工具/plan 附件
    ...result.hookResults,         // session start hooks 的结果
  ]
}
```

顺序是有意义的：
1. boundary marker 先来，让 `getMessagesAfterCompactBoundary` 能正确切片
2. 摘要消息放在 boundary 后面，作为新历史的开头
3. 附件放在最后，模型看到附件时已经有了摘要上下文

---

## task_budget 的跨 compact 延续

这是一个容易被忽略的细节。`query.ts` 里维护了一个 `taskBudgetRemaining` 变量：

```typescript
// task_budget.remaining tracking across compaction boundaries
let taskBudgetRemaining: number | undefined = undefined

// 每次 compact 成功后：
if (params.taskBudget) {
  const preCompactContext = finalContextTokensFromLastResponse(messagesForQuery)
  taskBudgetRemaining = Math.max(
    0,
    (taskBudgetRemaining ?? params.taskBudget.total) - preCompactContext,
  )
}
```

原因：API 的 task_budget 是让服务端追踪"还剩多少 token 预算可用"的。压缩前，服务端能看到完整历史，自己算。压缩后，服务端只看到摘要，它不知道之前花了多少——所以客户端需要把累计消耗传给服务端，让它继续从正确的起点计算。

---

## 面试指导

这道题考察你追踪复杂系统执行路径的能力。

重点要提到：
1. **session memory 优先**：不是直接 compact，先检查有没有更轻量的路径
2. **PTL 容错**：compact 请求本身也可能太长，需要截断重试
3. **重注入**：compact 不是清空，文件/plan/技能/工具列表会被重新注入
4. **task_budget 连续性**：跨 compact 的 token 预算追踪需要客户端手动累计

能说清第 4 点，说明你理解了 compact 在 agentic task 的长期执行中是怎么保持状态连续性的。

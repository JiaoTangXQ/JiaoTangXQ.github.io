---
title: "session memory 的触发条件：token 阈值、tool call 计数与自然停顿点"
slug: "169-session-memory"
date: 2026-04-09
topics: [上下文管理, 会话连续性, 内存架构]
importance: 0.9
---

# session memory 的触发条件：token 阈值、tool call 计数与自然停顿点

面试题形式：**session memory 什么时候会更新？为什么不能在有 tool call 的 turn 结束时更新？**

## 三个触发条件

`shouldExtractMemory()` 的逻辑体现了三重约束必须同时满足才能触发更新：

```ts
export function shouldExtractMemory(messages: Message[]): boolean {
  const currentTokenCount = tokenCountWithEstimation(messages)
  if (!isSessionMemoryInitialized()) {
    if (!hasMetInitializationThreshold(currentTokenCount)) return false
    markSessionMemoryInitialized()
  }
  const hasMetTokenThreshold = hasMetUpdateThreshold(currentTokenCount)
  const toolCallsSinceLastUpdate = countToolCallsSince(messages, lastMemoryMessageUuid)
  const hasMetToolCallThreshold = toolCallsSinceLastUpdate >= getToolCallsBetweenUpdates()
  const hasToolCallsInLastTurn = hasToolCallsInLastAssistantTurn(messages)
  return (hasMetTokenThreshold && hasMetToolCallThreshold) ||
         (hasMetTokenThreshold && !hasToolCallsInLastTurn)
}
```

**条件 1：初始化阈值（默认 10,000 tokens）**

会话刚开始时 session memory 不激活，等上下文累积到 `minimumMessageTokensToInit`（默认 10,000）才开始追踪。这个值可以通过 GrowthBook 动态配置 `tengu_sm_config` 覆盖。

**条件 2：两次更新之间的最小增长（默认 5,000 tokens）**

`hasMetUpdateThreshold()` 检查「自上次提取后，上下文窗口增长了多少 token」，阈值是 `minimumTokensBetweenUpdate: 5000`。用的是上下文大小增量而非累计 API 消耗，与 autocompact 的 `tokenCountWithEstimation()` 共用同一套计量逻辑。

**条件 3：自上次更新后的 tool call 次数（默认 3 次）**

`countToolCallsSince()` 从 `lastMemoryMessageUuid` 开始往后数 assistant message 里的 `tool_use` block。至少 3 次 tool call 才视为「有足够新事实值得更新 notes」。

## 自然停顿约束

即使满足了 token 阈值，如果最后一个 assistant turn 还包含 tool call，更新也不会触发：

```ts
const hasToolCallsInLastTurn = hasToolCallsInLastAssistantTurn(messages)
```

为什么？session memory 提取是 forked agent 调用，如果在 tool call 执行中间触发，可能把「工具返回前」的状态写进 notes，造成状态不一致。等到 tool call 全部完成才是安全的提取点。

特殊规则：如果只有 token 阈值满足，且最后一轮没有 tool call（自然停顿），仍然触发更新——即使 tool call 计数还不够 3 次。这保证长时间文字问答后也能及时更新笔记。

## 更新机制：forked agent + sequential 保证

```ts
const extractSessionMemory = sequential(async function(context) { ... })
```

用 `sequential()` 包装的目的是：如果上一次 session memory 提取还没完成，新的提取请求会排队等待，防止两个提取 agent 并发写同一个文件造成竞争写入。

提取通过 `runForkedAgent()` 完成——fork 父会话的上下文，用独立子 agent 读取当前 `session_memory.md`，然后用 `FileEditTool` 更新文件。子 agent 的工具权限被严格限制：只允许对 memory 路径使用 `file_edit`，其他工具一概拒绝。

## 与 autocompact 的关系

`initSessionMemory()` 初始化时检查 `isAutoCompactEnabled()`：如果用户关闭了 autocompact，session memory 也不启动。原因是 session memory 的主要用途之一是为 `trySessionMemoryCompaction()` 提供轻量压缩的数据基础——没有 autocompact，这个功能就没有用武之地。

## 面试要点

**Q：`lastMemoryMessageUuid` 是做什么的？**

记录上一次 session memory 提取时消息列表最后一条消息的 UUID。`countToolCallsSince()` 用它作为计数起点，只统计此后新增的 tool call。autocompact 成功后会调用 `setLastSummarizedMessageId(undefined)` 清空它，因为压缩后的消息 UUID 全都换了。

**Q：为什么 session memory 只在 `repl_main_thread` querySource 下运行？**

子 agent、teammate、compact agent 等都有各自的 querySource，如果它们也触发 session memory 提取，会产生多个 agent 并发写同一文件的问题。主线程是唯一有权更新 session notes 的上下文。

**Q：remote mode 下 session memory 是否可用？**

`initSessionMemory()` 在 `getIsRemoteMode()` 为 true 时直接返回，不注册 hook。Remote mode 没有本地文件系统，无法维护 `session_memory.md`。

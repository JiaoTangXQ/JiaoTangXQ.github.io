---
title: "性能分析：microcompact 为什么比全量压缩快一个数量级？"
slug: "04-04-02-microcompact"
date: 2026-04-09
topics: [主循环]
summary: "autocompact 每次触发都需要调用 LLM 生成摘要，耗时 5-30 秒，成本折合大几毛钱。microcompact 的 cached 路径可以在几百毫秒内完成，成本几乎为零。两者处理的都是「上下文太长」，但机制完全不同。"
importance: 1
---

# 性能分析：microcompact 为什么比全量压缩快一个数量级？

假设你有一个 LLM Agent，在长会话里积累了 200 条消息，其中大量是工具调用结果（文件读取、命令输出、搜索结果）。每次调用 API，你都要把这 200 条消息全部发送过去，context window 已经用了 80%。

你有两个选择：
1. 触发 autocompact：调用一次 LLM 把整段历史总结成 5 页摘要，用摘要替换原来的 200 条消息
2. 触发 microcompact：识别出其中 150 条是"低信息密度的工具结果"，通知 API 服务器删掉这些缓存条目

方案 1 需要 5-30 秒，方案 2 需要几百毫秒。为什么差这么多？

## microcompact 的核心机制：cache editing

理解 microcompact 的关键是理解 **prompt cache**（提示词缓存）。

当你多次调用 Claude API 且消息前缀相同时，API 服务器会缓存这个前缀的计算结果（KV cache）。第一次调用时全量计算；后续调用如果前缀命中缓存，只需要计算新增的部分。这就是为什么长会话的后续轮次往往比第一轮快。

**cache editing** 是在这个机制上的一个扩展：你可以发送一个 `cache_edits` 指令，告诉 API 服务器："把缓存里这些 tool_use_id 对应的工具结果删掉，然后继续用剩下的缓存。"

效果：
- 服务端删除了这些工具结果的缓存条目
- 这些 token 不再被计入上下文
- **本地消息数组完全没有变化**
- 后续调用依然可以命中（更小的）缓存前缀

```typescript
// microcompact 的 cached 路径（简化版）
async function cachedMicrocompactPath(messages: Message[]) {
  const toolsToDelete = mod.getToolResultsToDelete(state)

  if (toolsToDelete.length > 0) {
    // 创建 cache_edits 块，发给 API 服务器
    const cacheEdits = mod.createCacheEditsBlock(state, toolsToDelete)
    pendingCacheEdits = cacheEdits  // 在下次 API 调用时附带发送

    // 本地消息不变 —— 这是关键
    return { messages }
  }
}
```

## 什么工具的结果可以安全删除？

microcompact 只删除被标记为 `COMPACTABLE_TOOLS` 的工具结果：

```typescript
const COMPACTABLE_TOOLS = new Set<string>([
  FILE_READ_TOOL_NAME,    // 文件读取
  ...SHELL_TOOL_NAMES,    // Bash / PowerShell
  GREP_TOOL_NAME,         // 搜索
  GLOB_TOOL_NAME,         // 文件列表
  WEB_SEARCH_TOOL_NAME,   // 网络搜索
  WEB_FETCH_TOOL_NAME,    // 网络抓取
  FILE_EDIT_TOOL_NAME,    // 文件编辑
  FILE_WRITE_TOOL_NAME,   // 文件写入
])
```

为什么这些工具的结果可以删？因为它们的内容通常是**可再生的**：
- 读过的文件可以重读
- 执行过的命令可以重执行（通常）
- 搜索结果可以重搜索

相比之下，用户消息、模型的推理文本、计划和决策这些**不可再生的内容**不会被 microcompact 删除。

## 时间触发器：cache 已经冷了就不用 cache editing

microcompact 有一个特殊的触发路径——**时间触发（time-based microcompact）**：

```typescript
export function evaluateTimeBasedTrigger(
  messages: Message[],
  querySource: QuerySource | undefined,
): { gapMinutes: number; config: TimeBasedMCConfig } | null {
  const lastAssistant = messages.findLast(m => m.type === 'assistant')
  const gapMinutes =
    (Date.now() - new Date(lastAssistant.timestamp).getTime()) / 60_000
  if (gapMinutes < config.gapThresholdMinutes) return null
  return { gapMinutes, config }
}
```

逻辑是：如果上一条 assistant 消息的时间戳已经超过了阈值（比如 30 分钟），说明 API 服务器的 KV cache 已经过期（Claude API 的 cache TTL 大约是 5 分钟）。既然 cache 已经冷了，就没必要用 cache editing——cache editing 的假设是"我在修改一个热缓存"，如果缓存已经没了，直接在本地修改消息内容反而更简单。

所以时间触发走的是**直接修改消息内容**的路径，而不是 cache editing：

```typescript
function maybeTimeBasedMicrocompact(messages: Message[]) {
  // 直接替换内容，不用 cache editing
  return { ...block, content: TIME_BASED_MC_CLEARED_MESSAGE }
}
```

这也意味着时间触发后需要 `resetMicrocompactState()`，清掉已注册的工具 ID，防止后续 cache editing 尝试删除一个不存在的 cache 条目。

## 两条路径的性能对比

| | cached microcompact | 时间触发 microcompact | autocompact |
|---|---|---|---|
| API 调用 | 无（仅附带 cache_edits） | 无 | 一次完整 LLM 调用 |
| 耗时 | <100ms | <10ms | 5-30s |
| 本地消息变化 | 无 | 有（替换为占位符） | 有（全量替换为摘要） |
| 缓存命中率 | 保持高（仅删除部分） | 下降（内容变化） | 归零（全新摘要） |
| 信息损失 | 低（只删工具结果） | 低（只删工具结果） | 高（历史细节丢失） |

## 使用限制

cached microcompact 只在特定条件下启用：

```typescript
if (
  mod.isCachedMicrocompactEnabled() &&
  mod.isModelSupportedForCacheEditing(model) &&
  isMainThreadSource(querySource)  // 只在主线程，不在 sub-agent
)
```

子 agent（session_memory、prompt_suggestion 等 fork agent）不走这条路径。原因：cachedMCState 是模块级全局变量，如果子 agent 也注册工具 ID，主线程可能会尝试删除一个从未在主线程 cache 里出现过的工具结果——这是一个经典的全局状态污染问题。

## 面试指导

这个机制的精妙之处在于：**利用了 API 缓存层的能力来减少上下文，而不是在应用层做昂贵的文本变换**。

如果面试官问你"如何在不丢失对话连续性的情况下减少 LLM 调用的 token 消耗"，cached microcompact 的思路是一个很好的答案：
1. 识别可安全删除的内容（低信息密度、可再生的工具结果）
2. 通过缓存编辑在服务端删除，而不是在本地改写消息
3. 本地消息保持不变，下次需要时仍然可以参考历史

这种"把状态维护的责任下推到缓存层"的思路，在大量高频 API 调用场景里很有参考价值。

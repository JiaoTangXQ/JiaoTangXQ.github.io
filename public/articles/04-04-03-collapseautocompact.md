---
title: "工程取舍：context collapse 和 autocompact 的设计边界在哪里？"
slug: "04-04-03-collapseautocompact"
date: 2026-04-09
topics: [主循环]
summary: "collapse 和 autocompact 都在「减少上下文」，但它们的设计目标和破坏性完全不同。理解这两个机制为什么要被分开、为什么 collapse 要先于 autocompact 执行，能让你看清 Claude Code 在「保留细节」和「保证系统不崩」之间的具体权衡。"
importance: 1
---

# 工程取舍：context collapse 和 autocompact 的设计边界在哪里？

在 Claude Code 的上下文管理链里，context collapse 和 autocompact 都出现在 microcompact 之后，但它们的设计理念有根本性的差异。理解这个差异，能帮你回答一个更通用的系统设计问题：**什么时候做可逆的局部压缩，什么时候做不可逆的全量改写？**

## Context Collapse：可逆的投影

context collapse 的核心是**折叠**而不是**删除**。当某段历史被 collapse，它不会从 `mutableMessages` 里消失，而是被记录在一个单独的 collapse store 里：

```
折叠操作: turn 5-15 的对话 → 折叠摘要 "讨论了数据库架构，最终选择了 PostgreSQL"

mutableMessages: 保留完整历史（turn 1-100）
collapseStore:   记录折叠日志（turn 5-15 → 摘要）

每次 query() 调用:
  projectView(mutableMessages, collapseStore)
  → 生成当前轮次的 messagesForQuery（已折叠的视图）
```

关键：`projectView()` 每次都会重放折叠日志，生成一个**投影视图**供 API 使用。底层的 `mutableMessages` 始终是完整的。这意味着：

- **可逆**：理论上，取消折叠只需要删除 collapseStore 里的记录
- **REPL 可见完整历史**：用户滚动查看聊天记录时看到的是完整的 `mutableMessages`
- **API 看到的是压缩视图**：模型调用时用的是 `projectView()` 的结果

代价是什么？`collapseStore` 需要持久化，每次 query 都要重放折叠日志（虽然有缓存），而且"已折叠片段"的摘要本身也占用 token。

## Autocompact：不可逆的改写

autocompact 是真正的"改写历史"：

```typescript
// autocompact 的结果
const postCompactMessages = buildPostCompactMessages(compactionResult)
// 这些 messages 是：
// 1. 一条 compact boundary 标记消息
// 2. 一条包含整段历史摘要的消息
// 3. 可能还有几条最近的消息（保护尾部）

// 用压缩后的 messages 替换原来的 messagesForQuery
messagesForQuery = postCompactMessages
```

这次替换是持久化的：`postCompactMessages` 会通过 `state.messages` 传到下一轮，`getMessagesAfterCompactBoundary()` 确保后续所有轮次都只看到 compact boundary 之后的内容。

**代价是永久性的信息损失**。被摘要掉的历史细节不会再回来，除非翻看 transcript 原始文件。

## 为什么 collapse 要先于 autocompact？

`query()` 里这两步的顺序是明确的：

```typescript
// 1. 先 collapse
if (feature('CONTEXT_COLLAPSE') && contextCollapse) {
  const collapseResult = await contextCollapse.applyCollapsesIfNeeded(
    messagesForQuery, toolUseContext, querySource,
  )
  messagesForQuery = collapseResult.messages
}

// 2. 再 autocompact（用 collapse 后的 messages 计算 token）
const { compactionResult } = await deps.autocompact(
  messagesForQuery, toolUseContext, ...
)
```

原因在源码注释里写得很清楚：

> Runs BEFORE autocompact so that if collapse gets us under the autocompact threshold, autocompact is a no-op and we keep granular context instead of a single summary.

翻译过来：如果 collapse 已经把 token 压到了 autocompact 阈值以下，autocompact 就不需要跑。这样保留了粒度更细的历史——只有最近被折叠的那些轮次被摘要了，其他都原封不动。

反过来，如果先跑 autocompact，整段历史都被压成一份摘要，然后再跑 collapse，collapse 就没有可操作的原始历史了。顺序反了，保留细节的机会就没了。

## 互斥保护：防止两个系统互相干扰

还有一个微妙的互斥逻辑。当 context collapse 被启用且 auto compact 也被启用时，proactive blocking limit 检查会被跳过：

```typescript
let collapseOwnsIt = false
if (feature('CONTEXT_COLLAPSE')) {
  collapseOwnsIt =
    (contextCollapse?.isContextCollapseEnabled() ?? false) &&
    isAutoCompactEnabled()
}

// 只有在 collapseOwnsIt = false 时才做 blocking limit 检查
if (
  !compactionResult &&
  !collapseOwnsIt &&
  !(reactiveCompact?.isReactiveCompactEnabled() && isAutoCompactEnabled())
) {
  if (isAtBlockingLimit) {
    yield createAssistantAPIErrorMessage({ content: PROMPT_TOO_LONG_ERROR_MESSAGE })
    return { reason: 'blocking_limit' }
  }
}
```

这个保护是为了防止一种死锁：
1. blocking limit 检查判断"context 太长，直接报错"
2. 但 collapse 或 reactive compact 明明可以处理这个情况
3. 如果报错发生在恢复系统有机会运行之前，恢复路径就被截断了

所以，当 collapse 或 reactive compact 被启用时，blocking limit 检查会被跳过，让 API 调用先发出去，等到真的收到 413 错误时再触发恢复。"把合成错误推迟到真实错误"——这是一个有意识的权衡，交换的是"提前报错的确定性"换"给恢复机制更多机会"。

## 工程取舍总结

| | Context Collapse | Autocompact |
|---|---|---|
| 机制 | 可逆投影 | 不可逆改写 |
| 原始历史 | 保留（REPL 可查） | 丢失 |
| 缓存影响 | 低（局部变更） | 高（全量失效） |
| LLM 调用 | 有（生成折叠摘要） | 有（生成完整摘要） |
| 适用场景 | 特定对话片段可被识别 | 整段历史需要替换 |
| 被禁止的场景 | 无 | compact/session_memory querySource |

## 面试指导

如果面试官让你解释"可逆压缩"和"不可逆压缩"的权衡，这是一个好的框架：

**可逆压缩**（collapse 风格）：
- 底层数据保留，投影视图给 API
- 适合"可能需要回溯"的场景
- 代价是需要维护投影逻辑和 store

**不可逆压缩**（autocompact 风格）：
- 直接替换历史，彻底释放 token
- 适合"历史已经没有细节价值"的场景
- 代价是信息永久丢失

Claude Code 的设计选择是：尽量先用可逆压缩，不得不时才用不可逆压缩。这个"保留可逆性尽量久"的原则在很多分布式系统设计里都有体现。

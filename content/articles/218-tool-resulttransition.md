---
title: "为什么 tool_result 必须显式补全，不能悬空？"
slug: "218-tool-resulttransition"
date: 2026-04-09
topics: [Claude Code 源码, tool_result, 主循环]
importance: 0.9
---

# 为什么 tool_result 必须显式补全，不能悬空？

## 问题本质

一个工具调用到一半被中断了——用户按了 Ctrl+C，或者 API 返回了错误。此时消息历史里有一个 `tool_use` block，但没有对应的 `tool_result`。

这个「悬空的 tool_use」会导致什么？

在 Anthropic API 的协议里，`tool_use` 和 `tool_result` 必须一一对应。如果历史消息里存在孤立的 `tool_use`，下一次 API 调用会报错：协议违规。

## yieldMissingToolResultBlocks

Claude Code 在 `query.ts` 里有一个专门处理这种情况的生成器函数：

```typescript
function* yieldMissingToolResultBlocks(
  assistantMessages: AssistantMessage[],
  errorMessage: string,
) {
  for (const assistantMessage of assistantMessages) {
    const toolUseBlocks = assistantMessage.message.content.filter(
      content => content.type === 'tool_use',
    ) as ToolUseBlock[]

    for (const toolUse of toolUseBlocks) {
      yield createUserMessage({
        content: [
          {
            type: 'tool_result',
            content: errorMessage,
            is_error: true,
            tool_use_id: toolUse.id,
          },
        ],
        toolUseResult: errorMessage,
        sourceToolAssistantUUID: assistantMessage.uuid,
      })
    }
  }
}
```

这个函数被调用的场景有多处：

1. **中断路径**：用户中断，还有 pending 的 tool_use 没拿到结果
2. **fallback 路径**：主模型失败切换 fallback 模型前，补全未完成的工具
3. **StreamingToolExecutor 丢弃时**：executor 被丢弃，队列里剩余的工具需要合成错误结果

每个场景都会显式调用这个函数，确保消息历史不出现悬空的 tool_use。

## 为什么不直接删除这条 tool_use？

这是一个设计判断题。删除 vs 补错误结果：

**删除的问题**：transcript 会不一致，resume 时无法还原现场。模型下次看到的历史是「我刚才发起了一个工具调用」，但历史里没有这条记录——这会造成模型混乱。

**补错误结果**：保留了「我发起了工具调用，但它失败/被中断了」这段历史。模型下次可以基于这个事实继续决策。

Claude Code 选择的是补错误结果。这也是为什么 `is_error: true` 是明确写进去的——不是假装成功，而是诚实地记录「这里出事了」。

## transition 与 tool_result 的关系

`transition.reason` 决定下一轮的起点，而干净的 tool_result 是这个机制的前提。

如果 `collapse_drain_retry` 触发了，意味着上下文需要被折叠重组。但折叠的前提是消息历史是合法的——每个 `tool_use` 都有配对的 `tool_result`。不然折叠算法处理的是一堆协议违规的消息，结果不可预测。

这就是为什么补全 tool_result 的逻辑在 transition 判断之前执行：先把现场清干净，再决定往哪里走。

## 面试延伸

面试官经常考「你的系统怎么处理工具调用失败」。浅层答案是「catch 错误、返回错误信息」。深层答案是：

1. 失败结果必须写回消息历史，不能只记日志
2. 写回的格式必须符合协议（`tool_result` + `is_error: true` + 原始 `tool_use_id`）
3. 中断和异常路径要和正常路径用同一套机制补全

Claude Code 的 `yieldMissingToolResultBlocks` 是这个答案的具体实现。它存在的理由很简单：**每次动作都必须正式结案，不能让悬案进入下一轮**。

---
title: "面试题：为什么 tool_use 没有对应的 tool_result 会导致 API 报错？"
slug: "04-08-01-tool-result"
date: 2026-04-09
topics: [主循环]
importance: 1
---

# 面试题：为什么 tool_use 没有对应的 tool_result 会导致 API 报错？

## Claude API 的约束：每个 tool_use 必须有对应的 tool_result

当你构建一个多轮对话，规则很简单：

```
合法的消息序列:
user: "分析这个文件"
assistant: [tool_use: read_file, id="toolu_abc"]  ← 调用工具
user: [tool_result: "文件内容...", tool_use_id="toolu_abc"]  ← 返回结果
assistant: "好的，我分析了这个文件..."  ← 正常回答

非法的消息序列:
user: "分析这个文件"  
assistant: [tool_use: read_file, id="toolu_abc"]  ← 调用工具
assistant: "好的，我分析了这个文件..."  ← 错误！缺少 tool_result
```

API 会拒绝第二个序列，因为：
1. 模型声明了它要调用工具（`tool_use` 块）
2. 但 conversation history 里没有工具的执行结果
3. API 无法为没有结果的工具调用继续推理

这是 Claude API 协议层的硬约束，不是 Claude Code 自己设计的规则。

## 为什么 Claude Code 需要主动补齐？

问题是：`query()` 里有很多情况会在**工具调用声明后、工具执行完成前**中断：

1. 用户按 Ctrl+C（中断）
2. 模型切换到 fallback（流式 fallback）
3. 底层异常（网络错误、进程崩溃等）
4. 工具执行超时

这些情况下，`assistantMessages` 里已经有了 `tool_use` 块，但没有对应的 `tool_result`。如果直接返回，下次恢复会话时，API 会收到一个 non-conforming 的 conversation history，报错：

```
Invalid request: Tool use without matching tool_result
```

这就是 `yieldMissingToolResultBlocks()` 存在的原因：

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
            content: errorMessage,   // ← 错误原因作为结果内容
            is_error: true,          // ← 标记为错误结果
            tool_use_id: toolUse.id, // ← 对应的 tool_use_id
          },
        ],
        toolUseResult: errorMessage,
        sourceToolAssistantUUID: assistantMessage.uuid,
      })
    }
  }
}
```

它为每个没有对应 `tool_result` 的 `tool_use` 生成一个**合成的错误 tool_result**，内容是错误原因（比如 `"Interrupted by user"` 或 `"Model fallback triggered"`）。

## 这个函数在哪些路径上被调用？

### 路径 1：用户中断（Ctrl+C）

```typescript
if (toolUseContext.abortController.signal.aborted) {
  if (streamingToolExecutor) {
    // StreamingToolExecutor 自己处理（可以生成更准确的合成结果）
    for await (const update of streamingToolExecutor.getRemainingResults()) {
      if (update.message) yield update.message
    }
  } else {
    // 降级：手动补齐
    yield* yieldMissingToolResultBlocks(
      assistantMessages,
      'Interrupted by user',
    )
  }
}
```

### 路径 2：底层异常

```typescript
} catch (error) {
  // ...
  yield* yieldMissingToolResultBlocks(assistantMessages, errorMessage)
  yield createAssistantAPIErrorMessage({ content: errorMessage })
  return { reason: 'model_error', error }
}
```

这里的逻辑是：即使发生了底层异常，也要先补齐所有 tool_result，才能输出错误消息。这样 transcript 在异常后依然是结构完整的，下次 resume 时可以正确处理。

### 路径 3：Fallback 模型切换

```typescript
if (innerError instanceof FallbackTriggeredError && fallbackModel) {
  yield* yieldMissingToolResultBlocks(
    assistantMessages,
    'Model fallback triggered',
  )
  assistantMessages.length = 0
  // ...重建状态
}
```

这里的补齐是在**清空 assistantMessages 之前**。原因：清空后就不知道哪些 tool_use 需要补 result 了。先补齐，再清空，顺序很重要。

## 合成 tool_result 的内容对模型的影响

合成的 tool_result 有 `is_error: true`，内容是错误原因字符串。当这些 tool_result 出现在下一轮的 conversation history 里，模型会看到：

```
assistant: [tool_use: read_file, id="toolu_abc"]
user: [tool_result: "Interrupted by user", is_error: true, tool_use_id="toolu_abc"]
```

模型会理解：上次我尝试读文件，但被用户中断了。这个信息是准确的，有助于模型在 resume 时做出合理决策（比如重新尝试读文件，或者询问用户是否要继续）。

相比之下，如果合成 tool_result 的内容是假的（比如返回一个成功的假结果），模型会基于错误的前提继续工作，可能产生完全错误的行为。

## Thinking Block 的特殊处理

有一段注释在 `query.ts` 里非常显眼，是关于 thinking blocks 的规则：

```typescript
/**
 * The rules of thinking are lengthy and fortuitous...
 * 1. A message that contains a thinking or redacted_thinking block must be
 *    part of a query whose max_thinking_length > 0
 * 2. A thinking block may not be the last message in a block
 * 3. Thinking blocks must be preserved for the duration of an assistant trajectory
 *    (a single turn, or if that turn includes a tool_use block then also its
 *    subsequent tool_result and the following assistant message)
 */
```

这说明：如果一个 assistant 消息包含 thinking block 且有 tool_use，对应的 tool_result 和下一个 assistant 消息也必须在同一次 API 调用里，否则 API 会报 thinking block 规则违反。

这是 tool_use/tool_result 配对规则的进一步强化版本，专门针对 extended thinking 模式。

## 面试指导

这道题的深层问题是：**如何保证一个有状态的、可以被中断的多轮对话在任意时刻都处于可恢复的状态？**

Claude Code 的答案：
1. **声明式地记录每个未完成的动作**：tool_use 块就是"我声明了这个动作"
2. **在任何退出路径上强制补齐**：不管是正常退出、中断、异常、fallback，都要保证 tool_use 有对应的 tool_result
3. **合成结果携带真实信息**：不造假，用错误信息告诉模型实际发生了什么

这个模式在分布式事务里有对应：每个开始的事务都必须有对应的提交或回滚，不允许"悬空事务"。工具调用的 tool_use/tool_result 配对，就是 LLM conversation 层面的事务完整性保证。

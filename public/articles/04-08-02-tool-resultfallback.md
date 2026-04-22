---
title: "边界条件：StreamingToolExecutor.discard() 和 getRemainingResults() 有什么本质区别？"
slug: "04-08-02-tool-resultfallback"
date: 2026-04-09
topics: [主循环]
importance: 1
---

# 边界条件：StreamingToolExecutor.discard() 和 getRemainingResults() 有什么本质区别？

`StreamingToolExecutor` 在主循环里有两种被"停止"的方式。理解它们的区别，需要先理解它们服务的不同场景。

## 场景一：Fallback 模型切换 → discard()

```typescript
// Fallback 时
if (innerError instanceof FallbackTriggeredError && fallbackModel) {
  if (streamingToolExecutor) {
    streamingToolExecutor.discard()         // ← discard
    streamingToolExecutor = new StreamingToolExecutor(...)  // ← 重建
  }
  assistantMessages.length = 0
  toolResults.length = 0
  // ...
}
```

Fallback 的情境：主模型不可用，整个流式请求失败。已经开始执行的工具，它们的结果对应的是旧模型生成的 `tool_use_id`。新模型会重新生成，产生新的 `tool_use_id`。

**旧 tool_use_id 的结果完全没有价值**——新模型不会引用它们，把它们 yield 出来只会污染 transcript。

`discard()` 的语义是：**静默丢弃**所有排队中和执行中的工具，它们的结果永远不会被 yield。已经在 OS 层面运行中的命令（比如 Bash）可能会继续跑完，但结果不会出现在输出流里。

之后重建一个新的 `StreamingToolExecutor`，完全干净的状态，准备为新模型的工具调用服务。

## 场景二：用户中断（Ctrl+C）→ getRemainingResults()

```typescript
// 用户中断时
if (toolUseContext.abortController.signal.aborted) {
  if (streamingToolExecutor) {
    for await (const update of streamingToolExecutor.getRemainingResults()) {
      if (update.message) {
        yield update.message  // ← yield 出来（即使是合成的取消结果）
      }
    }
  }
  // ...
}
```

用户中断的情境：用户主动停止了执行，但系统需要保持 transcript 结构完整，以便后续 resume。

`getRemainingResults()` 的语义是：**收集所有剩余结果**，包括：
- 已经完成的工具：返回真实结果
- 还在执行中的工具：等待中止后，生成合成的取消结果（`"Interrupted by user"`）
- 排队中还没开始的工具：生成合成的取消结果

这些合成结果会被 yield 出来，出现在 transcript 里。

## 为什么两种场景需要不同的处理？

关键差异在于：**这次的 tool_use_id 在未来还有意义吗？**

**Fallback 场景**：不会。新模型会生成全新的 tool_use_id，旧的 id 对应的结果没有任何消费者。如果把旧结果 yield 出来，transcript 里会出现没有对应 tool_use 的孤儿 tool_result（因为 assistantMessages 已经被清空了）。

**用户中断场景**：会。这次的 assistant 消息会被保留在 transcript 里（不打 tombstone，因为是正常的用户中断，不是模型错误），tool_use_id 依然需要对应的 tool_result，否则下次 resume 时 API 会报错。

## 两者的共同点：prevent orphaned tool_use

尽管实现不同，两者解决的是同一个底层问题：**确保每个 tool_use 都有对应的 tool_result**。

- `discard()` 通过"清空 assistantMessages，让旧的 tool_use 也消失"来解决
- `getRemainingResults()` 通过"为每个 tool_use 生成合成结果"来解决

两条路都达到了"transcript 里没有孤儿 tool_use"的目标，只是路径不同。

## 合成 tool_result 的内容规范

合成的取消/错误 tool_result 的内容格式比较统一：

```
来自 yieldMissingToolResultBlocks():
  "Interrupted by user"
  "Model fallback triggered"
  "<error.message>"

来自 StreamingToolExecutor 自身:
  "Streaming fallback - tool execution discarded"
  "Cancelled: parallel tool call <id> errored"  ← 兄弟工具被 sibling abort 取消
```

这些内容不是随意写的。模型会看到这些合成 tool_result，需要能够理解"这次工具调用没有成功，原因是..."并做出合理的后续决策。

比较这两种写法：

```
方案 A（信息丰富）: "Interrupted by user"
  → 模型理解：用户主动停了，也许用户想换个方向
  
方案 B（信息缺失）: ""（空字符串）
  → 模型困惑：工具调用结果是空的？可能是读了个空文件？
```

方案 A 让模型能够推断中断的原因，做出更合理的响应。

## 实际调试价值

在调试长会话问题时，transcript 里出现 `"Interrupted by user"` 或 `"Model fallback triggered"` 的 tool_result，是一个重要的诊断信号：

- 大量 `"Interrupted by user"` → 用户频繁中断，可能系统响应太慢
- `"Model fallback triggered"` → 主模型有可用性问题
- `"Cancelled: parallel tool call ... errored"` → 某个并发 Bash 命令失败，导致整批工具被取消

这些合成结果不是噪音，而是**系统事件的结构化记录**，比在 log 里写一行 `ERROR: tool cancelled` 更有可观测价值，因为它们直接出现在模型的 context 里，可以被模型感知到。

## 面试指导

这道题考察的是**异常路径的完整性保证**。

一个好的框架：
1. **识别不同中止场景**：fallback（需要全新开始）vs 用户中断（需要保留历史）
2. **分析每种场景的 tool_use_id 生命周期**：这决定了要丢弃结果还是生成合成结果
3. **合成结果的内容选择**：不造假，用真实原因告诉模型发生了什么

能说出"合成 tool_result 的目的不是欺骗模型，而是给模型准确的失败信息"的候选人，面试官会认为他理解了 LLM 会话管理的深层原则。

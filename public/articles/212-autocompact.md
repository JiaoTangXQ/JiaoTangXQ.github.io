---
title: "autocompact 的首要目标是让会话活下来，不是让它看起来整洁"
slug: "212-autocompact"
date: 2026-04-09
topics: [autocompact, 上下文管理, Claude Code 内核]
importance: 0.9
---

# autocompact 的首要目标是让会话活下来，不是让它看起来整洁

面试题版本：**"Claude Code 的 autocompact 在什么情况下触发？它的压缩质量和主动触发的 /compact 命令有区别吗？为什么有这个区别？"**

## autocompact 的触发条件

`src/services/compact/autoCompact.ts` 里的 `calculateTokenWarningState()` 函数持续监控 token 使用量。autocompact 在以下条件下触发：

```typescript
// 简化的触发逻辑
const effectiveWindow = getEffectiveContextWindowSize(model)
const currentTokens = getCurrentTokenCount(messages)
const usageRatio = currentTokens / effectiveWindow

if (usageRatio > AUTOCOMPACT_THRESHOLD) {  // 通常 90% 左右
  scheduleCompaction()  // 在当前回合结束后执行
}
```

阈值不是 100%，而是留了一些余量（通常 10%），保证当前回合能正常完成，然后在回合边界触发压缩。

## autocompact vs 主动 /compact 的区别

**主动 /compact**（用户手动触发或通过命令）：
- 在用户认为"当前是一个好的整理时机"时触发
- 可以有更多时间生成高质量的摘要
- 可以等待用户确认摘要内容是否准确
- 目标是生成有用的、结构化的对话摘要

**autocompact**（系统自动触发）：
- 在"不压缩就无法继续"时触发
- 时间有限（不能无限等待 LLM 生成摘要）
- 不能等用户确认
- 目标是**让会话活下来**，而不是生成最好的摘要

这个区别直接影响实现：autocompact 在质量和速度之间，会更偏向速度（确保会话不超限），在完整性和可继续性之间，会更偏向可继续性（保住关键线索，而不是追求摘要的文学质量）。

## 连续失败的处理

`AutoCompactTrackingState.consecutiveFailures` 字段是一个电路熔断器：如果 autocompact 连续失败（比如摘要生成失败、或者即使压缩后 token 仍然超限），系统会停止重试，而不是陷入无限的压缩尝试循环。

```typescript
export type AutoCompactTrackingState = {
  compacted: boolean
  turnCounter: number
  turnId: string
  consecutiveFailures?: number  // 连续失败次数，用作熔断
}
```

这个设计承认了一种现实：某些会话的 token 使用量可能无法通过摘要来有效降低（比如有大量的工具调用结果，每个都包含大量数据）。面对这种情况，与其不断重试失败的压缩，不如承认"这个会话已经无法通过自动压缩维持"，让用户做出决定。

## "保会话"优先于"漂亮摘要"

这个优先级设置有几层含义：

**速度优先于质量**：autocompact 的摘要可能没有主动 /compact 生成的详细。这是可以接受的权衡——用户宁可有一个质量平平但能继续工作的会话，也不要一个漂亮摘要但会话已经崩溃的情况。

**关键信息优先于全面性**：autocompact 的摘要会重点保留：当前任务状态、最近的重要决策、活跃的工具配置。这些比完整的对话回顾更重要。

**可继续性优先于可读性**：autocompact 生成的摘要可能不是最适合人类阅读的，但它会确保关键的机器可读信息（任务状态、计划列表、配置引用）格式正确，让模型可以接续工作。

## token 预算的视角

`MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000`（来自 autoCompact.ts 注释）这个设置说明了压缩的约束：摘要本身不能超过 2 万 token，否则压缩的效果会大打折扣（压缩后的历史加上新对话，可能很快又超限）。

这个上限在摘要质量（详细 = 更多 token）和压缩效率（摘要短 = 压缩效果好）之间做了取舍。autocompact 的实现必须在这个上限内尽量保留关键信息。

## 面试角度的总结

autocompact 的设计原则是"保住会话优先于摘要质量"，这不是降标准，而是认清了触发场景的约束：当 token 即将超限时，没有时间做高质量的慢速摘要，必须在有限时间内做出足够好的决定。这个优先级设置让会话的可继续性有了兜底保障，即使摘要不完美，至少会话不会因为上下文超限而被迫中断。

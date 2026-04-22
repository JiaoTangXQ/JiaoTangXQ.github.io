---
title: "autocompact 的触发阈值是怎么算的？为什么不是一个固定数字？"
slug: "10-03-01-autocompact"
date: 2026-04-09
topics: [上下文管理]
importance: 1
---

# autocompact 的触发阈值是怎么算的？为什么不是一个固定数字？

"在 context 使用到 80% 时触发压缩"——这种简单规则很常见，但 Claude Code 没用它。`autoCompact.ts` 里的阈值计算有几层推导，每一层都有来由。

---

## 从原始窗口到有效窗口

第一步：从原始上下文窗口减掉摘要输出的预留空间。

```typescript
export function getEffectiveContextWindowSize(model: string): number {
  const reservedTokensForSummary = Math.min(
    getMaxOutputTokensForModel(model),
    MAX_OUTPUT_TOKENS_FOR_SUMMARY,  // = 20_000
  )
  let contextWindow = getContextWindowForModel(model, getSdkBetas())
  return contextWindow - reservedTokensForSummary
}
```

为什么要减？因为 autocompact 触发的时候，系统需要发一个摘要请求给模型。这个请求本身会消耗 output tokens。如果等到窗口 100% 满了再触发，摘要请求可能因为没有足够的 output space 而失败。

注释里写明了 `MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000` 的来源：**p99.99 的 compact 摘要输出是 17,387 tokens**，取 20K 留了一些余量。

---

## 从有效窗口到触发阈值

第二步：从有效窗口再减掉 `AUTOCOMPACT_BUFFER_TOKENS`：

```typescript
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000

export function getAutoCompactThreshold(model: string): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model)
  return effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
}
```

这 13K 的 buffer 是为了确保从"检测到需要 compact"到"compact 请求实际发出"之间，主对话还在继续积累的那些 token 有地方放。不能刚好在阈值上触发，因为触发判断到实际执行有延迟，这段时间可能还会有新消息进来。

---

## 完整的分级结构

`calculateTokenWarningState()` 函数暴露了完整的分级阈值：

```typescript
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000    // autocompact 缓冲
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000  // 警告阈值
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000    // 错误阈值  
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000     // 手动阈值
```

从阈值从大到小排列，形成一个预警区间：

```
0% ─────────────────────────── 100% 上下文窗口
              │     │  │  │
              │     │  │  └─ blocking limit（contextWindow - 3K）：硬停
              │     │  └──── autocompact 触发（effectiveWindow - 13K）
              │     └──────── warning 显示（threshold - 20K）
              └────────────── 正常工作区
```

用户看到的上下文使用百分比显示（工具栏里的那个数字），是相对于 autocompact 阈值计算的，不是相对于原始窗口：

```typescript
const percentLeft = Math.max(
  0,
  Math.round(((threshold - tokenUsage) / threshold) * 100),
)
```

---

## 为什么阈值随模型变化

不同模型有不同的上下文窗口（claude-3-5-sonnet 是 200K，claude-3-haiku 可能更小，未来的模型可能更大）。同样，`getMaxOutputTokensForModel` 返回的 output token 上限也因模型而异。

如果用固定的 token 数，那在小窗口模型上可能不够用，在大窗口模型上又触发得太早。以"距离窗口顶部还有多少"来算，是更鲁棒的做法。

还有一个 env 覆盖机制，供测试用：

```typescript
const envPercent = process.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE
if (envPercent) {
  const parsed = parseFloat(envPercent)
  if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
    const percentageThreshold = Math.floor(effectiveContextWindow * (parsed / 100))
    return Math.min(percentageThreshold, autocompactThreshold)
  }
}
```

这让开发者可以在测试时把阈值调低（比如设为 10%），方便验证 autocompact 逻辑。

---

## snipTokensFreed 修正的必要性

`shouldAutoCompact()` 接受一个 `snipTokensFreed` 参数：

```typescript
export async function shouldAutoCompact(
  messages: Message[],
  model: string,
  querySource?: QuerySource,
  snipTokensFreed = 0,  // 来自 snip 操作的已释放 token 数
): Promise<boolean> {
  // ...
  const tokenCount = tokenCountWithEstimation(messages) - snipTokensFreed
  // ...
}
```

为什么需要修正？

`tokenCountWithEstimation` 从最近的 assistant message 的 API response 里读 `usage.input_tokens`。但 snip 操作删除了一些老的消息，而"最近的 assistant message"并没有重新请求 API——它的 `usage` 字段记录的是 snip **之前**的上下文大小。

不减掉 `snipTokensFreed`，autocompact 就会看到一个虚高的 token 数，可能误以为需要触发，尽管实际上 snip 已经把 token 数压到阈值以下了。

---

## 面试指导

"autocompact 的触发阈值怎么设计"是一个考察你对动态阈值 vs 固定阈值的取舍理解的题。

关键点：
1. **预留输出空间**：触发时还需要发摘要请求，必须给输出 token 留余量
2. **安全 buffer**：从检测到执行有延迟，窗口还在增长，buffer 是这段时间的保护
3. **模型相关**：上下文窗口大小因模型而异，固定数字不可移植
4. **修正外部压缩**：snip 操作不更新 usage 统计，阈值判断需要手动修正

能说清楚这四点，说明你理解的不只是"触发阈值是多少"，而是"为什么是这么算的"。

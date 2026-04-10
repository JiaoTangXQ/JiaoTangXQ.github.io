---
title: "thinking 停止后还留 30 秒，是在照顾刚把视线移过来的人"
slug: "11-07-05-thinking"
date: 2026-04-09
topics: [终端界面]
summary: "流式 thinking 停止后，isStreamingThinkingVisible 会继续维持 true 长达 30 秒（streamingEndedAt 到现在不超过 30000ms）。这个缓冲窗口不是随意的延迟，而是对「人的观看节奏」的主动适配。"
importance: 1
---

# thinking 停止后还留 30 秒，是在照顾刚把视线移过来的人

`Messages.tsx` 里有一段 thinking 可视性逻辑：

```typescript
const isStreamingThinkingVisible =
  streamingThinking.isStreaming ||
  (streamingThinking.streamingEndedAt !== null &&
   Date.now() - streamingThinking.streamingEndedAt < 30_000);
```

两个条件：正在流式输出，**或者**停止不超过 30 秒。

## 为什么需要这个缓冲窗口

模型在思考时，用户可能在做别的事情——等待、切换窗口、看手机。当他们把视线移回来时，thinking 已经结束了。如果 thinking 在结束的瞬间就消失，这些用户永远不知道模型刚才在想什么。

30 秒的缓冲给了「稍晚把视线移过来的人」一个机会。他们仍然能看到模型思考的摘要，理解这个回复的推理过程。

## 与「永远保留」的区别

另一种做法是让 thinking 永远留着，让用户随时可以回来看。但这在长会话里会产生问题：每次对话都有 thinking，随着会话累积，历史 thinking 会逐渐占据大量屏幕空间。

Claude Code 的解决方案是：**用 `lastThinkingBlockId` 和 `hidePastThinking` 组合**——只保留「当前这轮」的 thinking，历史轮次的 thinking 会被隐藏。30 秒缓冲 + 只保留当前轮次，这两个机制合在一起，让 thinking 在它最有价值的时刻可见，在它不再需要的时刻退场。

## 管理观看节奏

这里有一个微妙的设计意识：**数据是否结束，和用户是否已经看过，是两件不同的事**。

流式传输停止了，但并不意味着所有用户都已经读完了。UI 应该适配人的观看节奏，而不是严格同步于数据的生命周期。

这 30 秒代表的不是技术需求，而是「合理的人类视线延迟」——一个足够长的窗口，让大多数情况下稍晚看到这里的人也不会错过。

---
title: "stopHooks 把整理动作推迟到回合结束以后"
slug: "10-09-01-stophooks"
date: 2026-04-09
topics: [上下文管理]
summary: "这一页重点看“stopHooks-把整理动作推迟到回合结束以后”。对应源码主要是 `src/query/stopHooks.ts`。 这一章真正落在 `query/stopHooks.ts` 和 `u..."
importance: 1
---

# stopHooks 把整理动作推迟到回合结束以后

## 实现链

这一页重点看“stopHooks-把整理动作推迟到回合结束以后”。对应源码主要是 `src/query/stopHooks.ts`。
这一章真正落在 `query/stopHooks.ts` 和 `utils/hooks/postSamplingHooks.ts` 这些回合后插槽上。Claude Code 把很多整理动作推迟到回合结束之后，让记忆提炼、自动梦、compact 后处理这些动作在统一的尾声插槽里发生，而不是闯进当前生成过程。

## 普通做法

更直接的做法，是一旦某个整理条件满足，就在主回合中间立刻执行，让系统尽快完成所有后处理。

## 为什么不用

Claude Code 没这么做，因为整理动作会污染当前回合：它们会抢 token、插消息、改状态，还可能让用户正在看的主线程被打断。把整理统一推到 stop hooks / post-sampling hooks，是为了让主回合先落稳。

## 代价

这样做让主回合更干净，也更利于把尾声动作集中治理。代价是很多整理结果都会滞后一个回合尾声，看起来不像“立刻完成”，而像一种带延迟的后台制度。

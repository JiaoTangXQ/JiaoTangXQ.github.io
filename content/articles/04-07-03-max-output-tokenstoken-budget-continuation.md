---
title: "max output tokens 和 token budget continuation 为什么是两种不同续写"
slug: "04-07-03-max-output-tokenstoken-budget-continuation"
date: 2026-04-09
topics: [主循环]
summary: "这两个名字都带着“继续”的味道，所以很容易被误写成同一种机制。其实它们处理的是两种完全不同的中断。 `max output tokens` 处理的是回答被截断。模型本来还在说，只是这一段输出槽位不够了..."
importance: 1
---

# max output tokens 和 token budget continuation 为什么是两种不同续写

这两个名字都带着“继续”的味道，所以很容易被误写成同一种机制。其实它们处理的是两种完全不同的中断。

`max output tokens` 处理的是回答被截断。模型本来还在说，只是这一段输出槽位不够了，于是系统会先尝试扩容，再不行就明确塞进一句“直接接着说，不要道歉，不要重述”的恢复提示，让它从被砍断的地方续上。这里的重点是修复一段没说完的话。

`token budget continuation` 处理的则不是一句话没说完，而是一整轮工作已经花得太多。系统根据当前回合预算判断：这件事可以继续，但要换成更收敛的姿态往前走。于是它塞回去的是一种预算提醒，而不是“从半句话接上”的指令。这里的重点是治理整轮工作的消耗。

一个在修补输出截断，一个在管理回合成本。Claude Code 把它们硬拆开，说明它很清楚“继续”并不是单一动作，而是至少有不同尺度。

代码里这两件事走的是两条完全不同的续写路。遇到 `max_output_tokens`，系统会先尝试把上限提升到 `ESCALATED_MAX_TOKENS`，再不行就插入一条 `isMeta` 用户消息，明确要求“直接接着写，不要道歉，不要 recap”；而 token budget 走的是 `checkTokenBudget()`，根据百分比和 diminishing returns 决定是发一个温和 nudging message 继续，还是直接收尾。更普通的做法是给所有“继续”场景都塞同一种 `continue` 提示。

Claude Code 不这么偷懒，是因为“被硬截断”和“预算上不值得再继续”本来就不是一回事。前者要帮模型续上半句话，后者要帮系统控制整体成本。这样分得更对，但代价是会话里出现更多系统注入的 meta message，理解 transcript 时得知道这些不是用户手打的原话。

## 实现链
`max_output_tokens` 走提额或 meta 续写提示，token budget 走 `checkTokenBudget()` 的成本型 nudging。

## 普通做法
所有继续场景都发同一种 `continue`。

## 为什么不用
因为硬截断和预算不值得再花不是同一类问题。

## 代价
transcript 里会出现更多系统注入的 meta 消息。

---
title: "transition 字段为什么能让主循环不至于失控"
slug: "04-08-04-transition"
date: 2026-04-09
topics: [主循环]
summary: "Claude Code 的主循环并不是“只要没结束就继续转”。每一次继续，它都尽量留下一个明确理由。这就是 `transition` 字段真正重要的地方。 表面上看，这只是循环状态里的一个小记录，像是..."
importance: 1
---

# transition 字段为什么能让主循环不至于失控

Claude Code 的主循环并不是“只要没结束就继续转”。每一次继续，它都尽量留下一个明确理由。这就是 `transition` 字段真正重要的地方。

表面上看，这只是循环状态里的一个小记录，像是给测试看的注释。其实它在表达一条很深的工程原则: 继续下一轮必须是有类型的。是普通的 `next_turn`，还是因为上下文塌了要 `collapse_drain_retry`，还是 stop hook 产生了阻塞，还是 token budget 要求继续，系统都要说清楚。这样一来，“继续”就不再是模糊动作，而是可解释的恢复路径。

这很重要，因为一台会压缩、会 fallback、会跑 hooks、会注入附件、会中途补救的 agent，如果没有这层理由标记，后面很快就会变成一团谁也说不清的递归。Claude Code 在这里表现出很强的自我约束: 它允许路径越来越复杂，但不允许继续的原因越来越含糊。

所以 `transition` 不只是状态字段，它更像主循环写给自己的病历本。复杂系统真正怕的不是分支多，而是分支多到最后没人知道自己为什么还在往前走。

代码里，`State.transition.reason` 已经承担了续跑语义：`next_turn`、`collapse_drain_retry`、`reactive_compact_retry`、`max_output_tokens_escalate`、`max_output_tokens_recovery`、`stop_hook_blocking`、`token_budget_continuation` 等等，都会直接决定下一轮该保留什么、追加什么、重置什么。更普通的实现常用一堆布尔位，例如 `shouldRetry`、`didCompact`、`needsContinuation`，或者干脆在各个分支里直接递归调用下一轮。

Claude Code 选了显式 reason，而不是散乱标志位，是因为它这里的“继续”种类太多，不能只靠“要不要继续”来描述。这样更容易保证恢复逻辑不串线，但代价是状态对象会比单纯布尔方案重很多，想看懂一轮为什么又起了一轮，必须顺着 reason 去读。

## 实现链
`State.transition.reason` 明确写出下一轮为什么存在。

## 普通做法
用几组布尔位或直接递归调用下一轮。

## 为什么不用
因为这里的“继续”种类太多，光知道要不要继续不够。

## 代价
状态对象更大，阅读门槛更高。

---
title: "第十三卷回收索引：前四卷里的 `transition` 把继续理由制度化"
slug: "252-transition"
date: 2026-04-09
topics: [参考]
summary: "`State.transition.reason` 直接写出下一轮为什么存在，取值已经包括 `next_turn`、`collapse_drain_retry`、`reactive_compact_r..."
importance: 0.9
---

# 第十三卷回收索引：前四卷里的 `transition` 把继续理由制度化

## 实现链
`State.transition.reason` 直接写出下一轮为什么存在，取值已经包括 `next_turn`、`collapse_drain_retry`、`reactive_compact_retry`、`max_output_tokens_escalate`、`max_output_tokens_recovery`、`stop_hook_blocking` 和 `token_budget_continuation`。

## 普通做法
更普通的做法，是用一组布尔位表示“要不要继续”，或者干脆在各个分支里直接递归调用下一轮。

## 为什么不用
Claude Code 不这么做，因为这里的“继续”种类太多，光知道要不要继续已经不够，必须知道为什么继续。

## 代价
代价是状态对象更大，阅读一轮为什么又起了一轮时，也必须顺着 reason 去读。

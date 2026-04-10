---
title: "虚拟滚动上线后，200 条 cap 退化成兜底"
slug: "11-09-32-200-transcript-cap"
date: 2026-04-09
topics: [终端界面]
summary: "Messages.tsx 里的 MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE 在 virtualScrollRuntimeGate 打开时不再主导主路径。真正控制可见范围的变成了视口和虚拟滚动，旧上限只剩兜底角色。"
importance: 1
---

# 虚拟滚动上线后，200 条 cap 退化成兜底

`Messages.tsx` 里有一个常量：`MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE`（值是 200 左右）。这是 transcript 视图的消息显示上限，防止全量渲染时性能崩溃。

但当 `virtualScrollRuntimeGate` 为 `true`，这个上限就不再是主路径的裁判了。

## 两套控制机制

**旧机制**（cap 为主）：
- 取最新的 N 条消息
- 超出的直接不渲染
- 简单、可预测，但无法处理用户「想往前看历史」的需求

**新机制**（虚拟滚动为主）：
- 由视口位置决定挂载范围
- 超出视口的消息进入 spacer
- 用户可以自由滚动查看任何历史位置

两套机制共存在代码里，通过 `virtualScrollRuntimeGate` 控制哪套生效。

## cap 退化为兜底的实际意义

`virtualScrollRuntimeGate` 为 `true` 时，消息区的「可见范围」由 `VirtualMessageList` 的窗口逻辑决定，不再受 200 条上限的直接约束。用户可以滚到 transcript 里的任何位置。

旧 cap 仍然存在，作为安全网：如果虚拟滚动因为某些原因没有正常工作，cap 确保至少不会把几千条消息全部挂载到 DOM 里。

这是一个稳健的迁移策略：新机制上线，旧机制退居二线，不立即删除。等到新机制经过足够实战验证，旧的 cap 才是真正可以清理掉的历史代码。

## 功能标志的价值

`virtualScrollRuntimeGate` 这样的功能标志，让两套机制可以在同一份代码里共存，按条件激活。这是在说：架构演进不一定是原地重写，有时候是平行共存，然后逐步迁移。

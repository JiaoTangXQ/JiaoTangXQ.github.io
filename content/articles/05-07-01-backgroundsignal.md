---
title: "backgroundSignal 为什么像交棒信号而不是硬打断"
slug: "05-07-01-backgroundsignal"
date: 2026-04-09
topics: [任务与分派]
summary: "`backgroundSignal` 的设计很能体现 Claude Code 的风格：它不喜欢把前后台切换做成一次暴力中断，而更像一次正式交棒。 `registerAgentForeground()`..."
importance: 1
---

# backgroundSignal 为什么像交棒信号而不是硬打断

`backgroundSignal` 的设计很能体现 Claude Code 的风格：它不喜欢把前后台切换做成一次暴力中断，而更像一次正式交棒。

## 实现链

`registerAgentForeground()` 会创建一个 `backgroundSignal` Promise，并把 resolver 存进 `backgroundSignalResolvers`。当用户选择转后台时，`backgroundAgentTask()` 先把任务的 `isBackgrounded` 改成 `true`，再 resolve 这个 Promise。同步执行循环那边则通过 race 感知“该交棒了”，后续用后台路径继续跑。

这里没有直接把 agent 砍掉重开，而是用一个明确的转场信号把同一任务从前台交给后台。

## 普通做法

普通做法往往是硬切。要么当前执行直接取消，再重新开一个后台任务；要么简单把 UI 隐掉，后台继续跑但没有正式交接点。

## 为什么不用

Claude Code 不喜欢硬切，是因为硬切最容易丢语义。你可能丢掉当前进度、丢掉输出连续性、丢掉“这其实是同一任务”的身份感。它要的是一次有秩序的转场，而不是重新投胎。

所以 `backgroundSignal` 更像“你可以下台了，后台同一个任务接着演”，不是“你死一次，我再拉个替身上来”。

## 代价

代价是代码上要维护 resolver map、转场时序和两边执行循环的配合关系。这比直接 kill/restart 难写很多，也更考验状态一致性。

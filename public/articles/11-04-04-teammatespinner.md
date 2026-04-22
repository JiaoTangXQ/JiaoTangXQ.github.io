---
title: "查看已完成队友时，spinner 提示会主动退场"
slug: "11-04-04-teammatespinner"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 查看已完成队友时，spinner 提示会主动退场

界面中的每一条提示都在竞争同一块稀缺空间。好的界面会替用户做第一轮筛选：什么提示现在值得出现，什么提示应该暂时退场。

## 触发条件

`PromptInputFooterLeftSide.tsx` 里，`ModeIndicator` 渲染时有一条注释写得很直接：

> Don't append spinner hints when viewing a completed teammate

这里的判断链是：`isViewingTeammate` 为真，且 `viewedTask.status !== 'running'`，意味着 `isViewingCompletedTeammate` 为真。在这个状态下，即使系统其他地方还有 spinner 在转，这块 footer 也不会再把那些 spinner 提示追加进来。

底部只会保留「esc to return to team lead」这类关系语气的文案。

## 为什么不是所有 spinner 都值得出现

想象一下：你正盯着一个已经跑完的 teammate 的输出记录，底部却一直提示「系统正在处理中，可以按 Ctrl+C 中断」。这是个真实的谎言——这个 teammate 已经不在运行了，那个 interrupt 提示对应的是别的东西。

Claude Code 不接受这种信息混淆。哪怕技术上系统还在忙，当前视图里最重要的事实是：你正站在一个已经完成的队友的现场，下一个有意义的操作是「回去」，而不是「中断」。

## 优先级的翻译

这类判断本质上是一种**情境优先级**的翻译工作：

- 系统状态（忙碌、spinner）是背景信息
- 当前视图关系（你在看谁、那个对象处于什么状态）是前景信息

当两者冲突时，前景覆盖背景。底部提示服从的是你当前所处的关系，而不是系统某个不相干的状态。

这个规则很小，但它解释了为什么在同样的「系统忙碌」条件下，不同视图的底部提示可以完全不同——因为界面先问「你在看什么」，再决定「应该告诉你什么」。

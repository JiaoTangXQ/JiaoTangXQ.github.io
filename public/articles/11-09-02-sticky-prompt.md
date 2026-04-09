---
title: "sticky prompt 和搜索锚点是在替人找回局部上下文"
slug: "11-09-02-sticky-prompt"
date: 2026-04-09
topics: [终端界面]
summary: "StickyTracker 会从滚动位置反推最近的用户 prompt，再把它写进 ScrollChromeContext 让 FullscreenLayout 画出 sticky header。搜索这..."
importance: 1
---

# sticky prompt 和搜索锚点是在替人找回局部上下文

## 实现链
StickyTracker 会从滚动位置反推最近的用户 prompt，再把它写进 ScrollChromeContext 让 FullscreenLayout 画出 sticky header。搜索这边则靠 searchAnchor 和 JumpHandle，把临时试探、回退和下一次命中绑成同一个局部上下文。

## 普通做法
普通做法通常只保留当前输入框的状态，或者把搜索结果直接跳到命中行。那样没有局部记忆，用户一旦滚远或搜错，就很难判断自己是从哪一段内容出发的。

## 为什么不用
这里要服务的是长 transcript 里的连续阅读，不是单点定位。sticky prompt 负责你现在在看谁在回答什么，search anchor 负责你刚才试了什么，两者缺一都会让回头路变钝。

## 代价
代价是滚动、搜索和 chrome 之间要共享更多状态，且任何一次位置变化都可能触发重算。好处是用户不用靠记忆补上下文，界面自己会把来路找回来。

---
title: "Logo 也要 memo 住，说明长会话里连页头乱动都会拖垮整段重绘"
slug: "11-07-10-logomemo"
date: 2026-04-09
topics: [终端界面]
summary: "`Messages.tsx` 里的 `LogoHeader` 被 `React.memo` 包住，内部再放 `LogoV2` 和 `StatusNotices`，这样消息数组一变，也不一定把页头一起重..."
importance: 1
---

# Logo 也要 memo 住，说明长会话里连页头乱动都会拖垮整段重绘

## 实现链
`Messages.tsx` 里的 `LogoHeader` 被 `React.memo` 包住，内部再放 `LogoV2` 和 `StatusNotices`，这样消息数组一变，也不一定把页头一起重新刷掉。它的目的不是省一个 logo，而是别让最上面的那点脏状态把后面整段消息重绘拖慢。

## 普通做法
普通列表常常把页头当成普通装饰，每次父组件刷新就跟着一起重建。

## 为什么不用
Claude Code 的会话可能很长，页头看起来再轻，也会参与整棵树的脏标记传播。这里把它单独 memo，是因为它要服务的是整段滚动体验，不是单独一块“看着不重要”的装饰。

## 代价
代价是顶部结构多了一层 memo 和冻结壳，读代码时不如直写那么顺。好处是长会话里页面更稳，不会因为页头抖动把后面都拖重绘。

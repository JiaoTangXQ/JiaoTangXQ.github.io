---
title: "collapse 和 autocompact 为什么要作为后手"
slug: "04-04-03-collapseautocompact"
date: 2026-04-09
topics: [主循环]
summary: "到了 `collapse` 和 `autocompact` 这一层，Claude Code 已经不再只是做局部减重，而是在承认：上下文管理系统要正式出手了。 它们之所以适合作为后手，是因为代价更大。`..."
importance: 1
---

# collapse 和 autocompact 为什么要作为后手

到了 `collapse` 和 `autocompact` 这一层，Claude Code 已经不再只是做局部减重，而是在承认：上下文管理系统要正式出手了。

它们之所以适合作为后手，是因为代价更大。`collapse` 会把一部分历史折叠成另一种可投影视图，`autocompact` 则可能真的把整段上下文重组，甚至优先尝试 `session memory` 路线。系统连它们之间的先后都很谨慎：先让 `collapse` 试着把粒度更细的折叠提交掉，再判断是不是还需要 `autocompact`。某些模式下，Claude Code 甚至会主动压住 `autocompact`，避免它和 `collapse` 抢着处理同一个问题。

这说明它从来没把自动压缩当成越早越好。后手的意思不是“不重要”，而是“只有轻方法不够时才该轮到你”。这样才能把真正昂贵的上下文改造留在最后。

所以 `collapse` 和 `autocompact` 像重装部队，平时不抢前线，但真要上场，就说明系统已经准备接受更大规模的重组了。

代码里这两层都是后手：`contextCollapse.recoverFromOverflow()` 会先尝试把已经 staged 的折叠内容排干，`reactiveCompact.tryReactiveCompact()` 再承担更重的总结式修复。更普通的路线是每次接近上限就立刻做全量 compact，因为这样最稳定、最容易预测 token 数。但这会把“便宜且可逆的小修”全部跳过，让每次压力都直接变成一次叙事重写。

Claude Code 把它们放后面，是在尽量延迟“改写历史”的时刻。只有前面的 snip、microcompact、collapse drain 都不够，才允许真正改写历史摘要。这样保留了更多原始上下文，但代价是恢复路径更多，读者也要理解“drain 阶段”和“compact 阶段”不是一回事。

## 实现链
先 drain staged collapse，再由 `reactiveCompact` 做更重的总结修复。

## 普通做法
每次接近上限都立刻全量 compact。

## 为什么不用
因为系统想尽量延迟“改写历史”的时刻。

## 代价
恢复路径更多，阶段也更难讲。

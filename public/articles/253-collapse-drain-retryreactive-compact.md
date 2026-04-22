---
title: "第十三卷回收索引：前四卷里的 collapse drain retry 与 reactive compact 的分级补救"
slug: "253-collapse-drain-retryreactive-compact"
date: 2026-04-09
topics: [参考]
importance: 0.9
---

# 第十三卷回收索引：前四卷里的 collapse drain retry 与 reactive compact 的分级补救

## 实现链
`contextCollapse.recoverFromOverflow()` 先尝试把已经 staged 的 collapse 排干，顺利的话就把 `transition.reason` 设成 `collapse_drain_retry` 再跑一轮；只有这一步不够，才调用 `reactiveCompact.tryReactiveCompact()` 去生成新的 post-compact messages。

## 普通做法
更普通的做法，是只留 `reactive compact` 一把刀，超长了就直接重组上下文。

## 为什么不用
Claude Code 不这么做，因为排干 staged collapse 比重写历史更便宜，也更能保住现场的细节。

## 代价
代价是恢复不再只有一条路，排干失败、摘要失败和两者都试过这几种情况都要能分清。

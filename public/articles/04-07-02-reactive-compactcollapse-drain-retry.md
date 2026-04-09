---
title: "reactive compact 和 collapse drain retry 在救什么"
slug: "04-07-02-reactive-compactcollapse-drain-retry"
date: 2026-04-09
topics: [主循环]
summary: "表面看，这两条路径都像“上下文太长了，再压一压”。Claude Code 实际上把它们分得很细，因为它知道不是所有超长都该用同一种补救。 `collapse drain retry` 更像先把已经准备..."
importance: 1
---

# reactive compact 和 collapse drain retry 在救什么

表面看，这两条路径都像“上下文太长了，再压一压”。Claude Code 实际上把它们分得很细，因为它知道不是所有超长都该用同一种补救。

`collapse drain retry` 更像先把已经准备好的压缩成果拿出来用。系统如果早就攒着一批 staged collapse，就先把这些比较温和的折叠提交掉，再试一次。只有这条路走不通，才会让 `reactive compact` 上场。后者更像一次真正的应急手术，它会在 413 或媒体过大这类场景下主动重组上下文，把失败重新翻译成还能继续的一轮。

这里最见功力的，是先后顺序。Claude Code 没有一上来就做最重的补救，而是先问：有没有更轻、更少破坏当前现场的方法？有的话先用，没有再动刀。这样既保住了连续性，也避免把每次压力都升级成大手术。

所以这两条路救的不是同一件事。一个救的是“已经准备好的折叠现在终于该提交了”，另一个救的是“真的快撑爆了，必须立刻重组现场”。

代码里，`contextCollapse.recoverFromOverflow()` 先尝试把已经 staged 的折叠内容排干，只要还能靠排干解决，就把 `transition.reason` 设成 `collapse_drain_retry` 再来一轮；只有这一步不够，才调用 `reactiveCompact.tryReactiveCompact()` 生成新的 post-compact messages。更直接的实现是只留 reactive compact 一把刀，因为逻辑更统一。

Claude Code 先 drain 再 compact，是在把“便宜补救”和“重写历史”分开。这样通常更值，因为 collapse drain 还能保住更细的现场纹理；代价是失败恢复不再只有一条路，读代码时必须跟着判断“现在是排干失败，还是摘要失败，还是两者都试过了”。

## 实现链
先 `contextCollapse.recoverFromOverflow()` 排干 staged collapse，不够再 `tryReactiveCompact()`。

## 普通做法
只留 reactive compact 一把刀。

## 为什么不用
因为排干比重写历史更便宜，也更保细节。

## 代价
恢复判断分支会更多。

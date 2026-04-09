---
title: "既扫现役 sock 也保 legacy fallback，说明恢复链要同时照顾现在和过去"
slug: "12-07-10-socklegacy-fallback"
date: 2026-04-09
topics: [外延执行]
summary: "`getAllSocketPaths()` 没有只看当前目录里的现役 `sock` 文件，它还会把旧版留下来的 fallback 路径一起带上。这说明恢复链面对的不只是“现在这套设计”，还包括“过去那..."
importance: 1
---

# 既扫现役 sock 也保 legacy fallback，说明恢复链要同时照顾现在和过去

`getAllSocketPaths()` 没有只看当前目录里的现役 `sock` 文件，它还会把旧版留下来的 fallback 路径一起带上。这说明恢复链面对的不只是“现在这套设计”，还包括“过去那套还没完全消失的现实”。

这正是长期工程的难点。真正要长期跑的系统，不能只面向今天最干净的结构，也得替昨天留下来的接缝留一条体面的退路。

## 实现链
`getAllSocketPaths()` 不只扫当前目录下的 `*.sock`，还会补上 legacy tmp 路径作为 fallback。它明显在照顾老版本和旧连接方式，而不是只认最新规则。

## 普通做法
更干净的做法是只认当前新路径，旧路径一律判死。

## 为什么不用
Claude Code 不这么绝，因为浏览器桥是长连接设施，兼容旧 socket 路径能减少升级后“明明装了却连不上”的现场事故。

## 代价
代价是代码里会保留一些历史味道，路径逻辑不够纯粹。


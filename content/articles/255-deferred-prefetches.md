---
title: "第十三卷回收索引：前四卷里的 deferred prefetches 让首屏后继续预热成为接缝安排"
slug: "255-deferred-prefetches"
date: 2026-04-09
topics: [参考]
importance: 0.9
---

# 第十三卷回收索引：前四卷里的 deferred prefetches 让首屏后继续预热成为接缝安排

## 实现链
`startDeferredPrefetches()` 会在首屏后继续拉起一串预热：用户信息、用户上下文、system context、提示信息、云厂商凭据、文件统计、分析开关、官方 MCP 列表、模型能力、设置变更探测器、技能变更探测器和事件循环卡顿探测。

## 普通做法
更普通的做法，是要么把这些事都塞到首屏前，要么在启动时一股脑并发开跑。

## 为什么不用
Claude Code 不这么做，因为前者会挡住第一次渲染，后者又会把 CPU 和事件循环一起搅乱。

## 代价
代价是启动不再是一个单点，而是一段前台和后台交错的过程。

---
title: "非虚拟 cap 同时存 uuid 和 index，说明位置锚点要扛住重组漂移"
slug: "11-07-12-capuuidindex"
date: 2026-04-09
topics: [终端界面]
summary: "`computeSliceStart()` 不只看一个 `uuid`，也不只看一个位置号，而是把 `sliceAnchorRef` 里的 `uuid + idx` 一起当锚点。当前锚点找得到就跟着它走..."
importance: 1
---

# 非虚拟 cap 同时存 uuid 和 index，说明位置锚点要扛住重组漂移

## 实现链
`computeSliceStart()` 不只看一个 `uuid`，也不只看一个位置号，而是把 `sliceAnchorRef` 里的 `uuid + idx` 一起当锚点。当前锚点找得到就跟着它走，找不到就退回到原来的 index，尽量别让折叠、重排、compaction 把读者一下甩回头。

## 普通做法
普通列表常会直接记“现在从第几条开始画”，或者只靠一个尾部 id 做截断，不会再留一个备用坐标。

## 为什么不用
Claude Code 的消息世界会被重组，单独一个坐标很容易漂。它要保的是“你大概还站在哪一段历史里”，所以索性把身份和位置都留下，彼此校正。

## 代价
代价是这块逻辑不再简单，既要懂数组截断，也要懂锚点修复。好处是长会话里不会因为消息结构抖动就把视野重置得太厉害。

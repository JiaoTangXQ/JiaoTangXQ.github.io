---
title: "搜索高亮用 message-relative positions：滚动后重算 rowOffset 才不漂"
slug: "11-09-35-message-relative-positionsrowoffset"
date: 2026-04-09
topics: [终端界面]
importance: 1
---

# 搜索高亮用 message-relative positions：滚动后重算 rowOffset 才不漂

搜索高亮的「黄色 current 位置」需要精确标记「当前命中在哪条消息的哪一行里」。

这里有一个坐标系的问题：命中位置应该用**屏幕坐标**（第几行？）表示，还是用**消息内坐标**（这条消息的第几行？）表示？

## 屏幕坐标的问题

如果存储「命中在屏幕的第 42 行」，那么：

1. 用户滚动一下，第 42 行的内容变了，高亮就指向了错误的地方
2. 新消息加载、行高变化，第 42 行对应的内容也会变

屏幕坐标是一个随滚动状态持续变化的量，不适合作为稳定的命中标记。

## message-relative positions 的设计

`scanElement` 扫描一条消息里的所有命中时，给出的是相对于这条消息内部的坐标——「消息里第 3 行第 7 列开始，长 5 个字符」。

这个坐标是稳定的：不管视口怎么滚，不管这条消息显示在屏幕哪个位置，消息内部的坐标不变。

## rowOffset 的角色

`setPositions({ positions, rowOffset, currentIdx })` 里的 `rowOffset` 是「这条消息的顶部当前在屏幕第几行」。它结合 `positions`（消息内坐标），就能算出「命中在屏幕的绝对位置」。

关键是：每次滚动时，`rowOffset` 都要重新计算（因为消息在屏幕上的位置确实变了），但 `positions` 不需要重算（消息内坐标没变）。

两层分离：稳定层（消息内坐标）+ 变化层（消息的当前屏幕位置）。稳定层存一次，变化层按需更新。结果是：高亮始终精确追踪「那个词」，而不是追踪「那个屏幕位置」。
